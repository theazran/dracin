const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = 'https://api.sansekai.my.id/api/netshort';
const DRAMABOX_BASE = 'https://dramabox.sansekai.my.id/api/dramabox';

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Helper to format heat score
app.locals.formatHeat = (score) => {
    if (!score) return '0';
    if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
    if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
    return score;
};

// Routes
app.get('/', async (req, res) => {
    try {
        const [theatersRes, forYouRes] = await Promise.all([
            axios.get(`${API_BASE}/theaters`),
            axios.get(`${API_BASE}/foryou`)
        ]);

        res.render('index', {
            title: 'Dracin - Nonton Drama China Pendek Premium',
            activeNav: 'netshort',
            theaters: theatersRes.data,
            forYou: forYouRes.data
        });
    } catch (error) {
        console.error('Error fetching Netshort data:', error.message);
        res.status(500).render('error', {
            title: 'Error | Dracin',
            activeNav: 'netshort',
            message: 'Gagal mengambil data drama Netshort.'
        });
    }
});

app.get('/dramabox', async (req, res) => {
    try {
        const [dbLatestRes, dbTrendingRes, dbVipRes, dbPopularRes, dbDubPopRes, dbDubNewRes] = await Promise.all([
            axios.get(`${DRAMABOX_BASE}/latest`),
            axios.get(`${DRAMABOX_BASE}/trending`),
            axios.get(`${DRAMABOX_BASE}/vip`),
            axios.get(`${DRAMABOX_BASE}/populersearch`),
            axios.get(`${DRAMABOX_BASE}/dubindo?classify=terpopuler`),
            axios.get(`${DRAMABOX_BASE}/dubindo?classify=terbaru`)
        ]);

        res.render('dramabox', {
            title: 'DramaBox - Koleksi Drama Pendek Terbaik | Dracin',
            activeNav: 'dramabox',
            dbLatest: dbLatestRes.data,
            dbTrending: dbTrendingRes.data,
            dbVip: dbVipRes.data.columnVoList || [],
            dbPopular: dbPopularRes.data || [],
            dbDubPop: dbDubPopRes.data || [],
            dbDubNew: dbDubNewRes.data || []
        });
    } catch (error) {
        console.error('Error fetching DramaBox data:', error.message);
        res.status(500).render('error', {
            title: 'Error | Dracin',
            activeNav: 'dramabox',
            message: 'Gagal mengambil data DramaBox.'
        });
    }
});

app.get('/search', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.redirect('/');

        const response = await axios.get(`${API_BASE}/search?query=${encodeURIComponent(query)}`);
        const searchResults = response.data.searchCodeSearchResult || [];

        res.render('search', {
            title: `Pencarian Netshort: ${query} | Dracin`,
            activeNav: 'netshort',
            query: query,
            results: searchResults
        });
    } catch (error) {
        console.error('Error searching Netshort:', error.message);
        res.status(500).render('error', {
            title: 'Error | Dracin',
            activeNav: 'netshort',
            message: 'Pencarian Netshort gagal.'
        });
    }
});

app.get('/dramabox/search', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.redirect('/dramabox');

        const response = await axios.get(`${DRAMABOX_BASE}/search?query=${encodeURIComponent(query)}`);

        res.render('search-db', {
            title: `Pencarian DramaBox: ${query} | Dracin`,
            activeNav: 'dramabox',
            query: query,
            results: response.data || []
        });
    } catch (error) {
        console.error('Error searching DramaBox:', error.message);
        res.status(500).render('error', {
            title: 'Error | Dracin',
            activeNav: 'dramabox',
            message: 'Pencarian DramaBox gagal.'
        });
    }
});

app.get('/dramabox/play/:id', async (req, res) => {
    try {
        const bookId = req.params.id;
        const episodeIndex = (parseInt(req.query.ep) || 1) - 1;

        const [episodesRes, detailRes] = await Promise.all([
            axios.get(`${DRAMABOX_BASE}/allepisode?bookId=${bookId}`),
            axios.get(`${DRAMABOX_BASE}/detail?bookId=${bookId}`)
        ]);

        const episodes = episodesRes.data || [];
        const dramaInfo = detailRes.data && detailRes.data.data ? detailRes.data.data.book : {};
        const currentEp = episodes.find(ep => ep.chapterIndex === episodeIndex) || episodes[0];

        let videoUrl = '';
        if (currentEp && currentEp.cdnList && currentEp.cdnList.length > 0) {
            const cdn = currentEp.cdnList.find(c => c.isDefault === 1) || currentEp.cdnList[0];
            const pathInfo = cdn.videoPathList.find(p => p.isDefault === 1) || cdn.videoPathList.find(p => p.quality === 720) || cdn.videoPathList[0];
            videoUrl = pathInfo ? pathInfo.videoPath : '';
        }

        res.render('play-db', {
            title: `${dramaInfo.bookName || 'DramaBox'} - Ep ${episodeIndex + 1} | Dracin`,
            activeNav: 'dramabox',
            bookId: bookId,
            currentEpisode: episodeIndex + 1,
            videoUrl: videoUrl,
            drama: dramaInfo,
            episodes: episodes,
            dramaJSON: JSON.stringify(dramaInfo),
            episodesJSON: JSON.stringify(episodes)
        });
    } catch (error) {
        console.error('Error fetching DramaBox play data:', error.message);
        res.status(500).render('error', {
            title: 'Error | Dracin',
            activeNav: 'dramabox',
            message: 'Gagal memuat link streaming DramaBox.'
        });
    }
});

app.get('/play/:id', async (req, res) => {
    try {
        const shortPlayId = req.params.id;
        const response = await axios.get(`${API_BASE}/allepisode?shortPlayId=${shortPlayId}`);
        const drama = response.data;

        // Default to first episode or query param
        const episodeNo = parseInt(req.query.ep) || 1;
        const currentEpisode = drama.shortPlayEpisodeInfos.find(ep => ep.episodeNo === episodeNo) || drama.shortPlayEpisodeInfos[0];

        res.render('play', {
            title: `${drama.shortPlayName} - Ep ${episodeNo} | Dracin`,
            activeNav: 'netshort',
            drama: drama,
            dramaJSON: JSON.stringify(drama),
            currentEpisode: currentEpisode
        });
    } catch (error) {
        console.error('Error fetching episodes:', error.message);
        res.status(500).render('error', {
            title: 'Error | Dracin',
            activeNav: 'netshort',
            message: 'Gagal memuat episode drama.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
