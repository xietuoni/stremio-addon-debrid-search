import Cinemeta from './util/cinemeta.js'
import Tmdb from './util/tmdb.js'
import DebridLink from './debrid-link.js'
import RealDebrid from './real-debrid.js'
import AllDebrid from './all-debrid.js'
import Premiumize from './premiumize.js'
import { BadRequestError } from './util/error-codes.js'
import { FILE_TYPES } from './util/file-types.js'

const searchThreshold = 0.25

const STREAM_NAME_MAP = {
    debridlink: "[DL+] DebridSearchFork",
    realdebrid: "[RD+] DebridSearchFork",
    alldebrid: "[AD+] DebridSearchFork",
    premiumize: "[PM+] DebridSearchFork"
}

async function getMeta(config, type, imdbId) {
    const TMDBApiKey = config["TMDBApiKey"]

    if (TMDBApiKey) {
        return await Tmdb.getMeta(type, imdbId, TMDBApiKey)
    } else {
        return await Cinemeta.getMeta(type, imdbId)
    }
}

function getSearchKeys(config, metadataDetails) {
    var languages = config["languages"]
    if (!languages || !languages.length) {
        languages = ["en-US"]
    }

    const names = metadataDetails['names']

    return languages.flatMap((language) => {
        const name = metadataDetails['names'].get(language)
        if (name) {
            return [name]
        }
        return []
    }
    )
}

async function getMovieStreams(config, type, id) {
    const metadataDetails = await getMeta(config, type, id)
    const searchKey = getSearchKeys(config, metadataDetails)

    console.log("searchKey", searchKey)

    let apiKey = config.DebridLinkApiKey ? config.DebridLinkApiKey : config.DebridApiKey

    if (config.DebridLinkApiKey || config.DebridProvider == "DebridLink") {
        const torrents = await DebridLink.searchTorrents(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const torrentIds = torrents
                .filter(torrent => filterYear(torrent, metadataDetails))
                .map(torrent => torrent.id)

            if (torrentIds && torrentIds.length) {
                return await DebridLink.getTorrentDetails(apiKey, torrentIds.join())
                    .then(torrentDetailsList => {
                        return torrentDetailsList.map(torrentDetails => toStream(torrentDetails))
                    })
            }
        }
    } else if (config.DebridProvider == "RealDebrid") {
        let results = []
        const torrents = await RealDebrid.searchTorrents(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const streams = await Promise.all(torrents
                .filter(torrent => filterYear(torrent, metadataDetails))
                .map(torrent => {
                    return RealDebrid.getTorrentDetails(apiKey, torrent.id)
                        .then(torrentDetails => toStream(torrentDetails))
                        .catch(err => {
                            console.log(err)
                            Promise.resolve()
                        })
                }))
            results.push(...streams)
        }

        const downloads = await RealDebrid.searchDownloads(apiKey, searchKey, searchThreshold)
        if (downloads && downloads.length) {
            const streams = await Promise.all(downloads
                .filter(download => filterYear(download, metadataDetails))
                .map(download => { return toStream(download, type) }))
            results.push(...streams)
        }
        return results.filter(stream => stream)
    } else if (config.DebridProvider == "AllDebrid") {
        const torrents = await AllDebrid.searchTorrents(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const streams = await Promise.all(
                torrents
                    .filter(torrent => filterYear(torrent, metadataDetails))
                    .map(torrent => {
                        return AllDebrid.getTorrentDetails(apiKey, torrent.id)
                            .then(torrentDetails => toStream(torrentDetails))
                            .catch(err => {
                                console.log(err)
                                Promise.resolve()
                            })
                    })
            )

            return streams.filter(stream => stream)
        }
    } else if (config.DebridProvider == "Premiumize") {
        const files = await Premiumize.searchFiles(apiKey, searchKey, searchThreshold)
        if (files && files.length) {
            const streams = await Promise.all(
                files
                    .filter(file => filterYear(file, metadataDetails))
                    .map(torrent => {
                        return Premiumize.getTorrentDetails(apiKey, torrent.id)
                            .then(torrentDetails => toStream(torrentDetails))
                            .catch(err => {
                                console.log(err)
                                Promise.resolve()
                            })
                    })
            )

            return streams.filter(stream => stream)
        }
    } else {
        return Promise.reject(BadRequestError)
    }

    return []
}

async function getSeriesStreams(config, type, id) {
    const [imdbId, season, episode] = id.split(":")
    const metadataDetails = await getMeta(config, type, imdbId)
    const searchKey = getSearchKeys(config, metadataDetails)

    let apiKey = config.DebridLinkApiKey ? config.DebridLinkApiKey : config.DebridApiKey

    if (config.DebridLinkApiKey || config.DebridProvider == "DebridLink") {
        const torrents = await DebridLink.searchTorrents(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const torrentIds = torrents
                .filter(torrent => filterSeason(torrent, season))
                .map(torrent => torrent.id)

            if (torrentIds && torrentIds.length) {
                return DebridLink.getTorrentDetails(apiKey, torrentIds.join())
                    .then(torrentDetailsList => {
                        return torrentDetailsList
                            .filter(torrentDetails => filterEpisode(torrentDetails, season, episode))
                            .map(torrentDetails => toStream(torrentDetails, type))
                    })
            }
        }
    } else if (config.DebridProvider == "RealDebrid") {
        let results = []
        const torrents = await RealDebrid.searchTorrents(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const streams = await Promise.all(torrents
                .filter(torrent => filterSeason(torrent, season))
                .map(torrent => {
                    return RealDebrid.getTorrentDetails(apiKey, torrent.id)
                        .then(torrentDetails => {
                            if (filterEpisode(torrentDetails, season, episode)) {
                                return toStream(torrentDetails, type)
                            }
                        })
                        .catch(err => {
                            console.log(err)
                            Promise.resolve()
                        })
                }))
            results.push(...streams)
        }

        const downloads = await RealDebrid.searchDownloads(apiKey, searchKey, searchThreshold)
        if (downloads && downloads.length) {
            const streams = await Promise.all(downloads
                .filter(download => filterDownloadEpisode(download, season, episode))
                .map(download => { return toStream(download, type) }))
            results.push(...streams)
        }
        return results.filter(stream => stream)
    } else if (config.DebridProvider == "AllDebrid") {
        const torrents = await AllDebrid.searchTorrents(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const streams = await Promise.all(torrents
                .filter(torrent => filterSeason(torrent, season))
                .map(torrent => {
                    return AllDebrid.getTorrentDetails(apiKey, torrent.id)
                        .then(torrentDetails => {
                            if (filterEpisode(torrentDetails, season, episode)) {
                                return toStream(torrentDetails, type)
                            }
                        })
                        .catch(err => {
                            console.log(err)
                            Promise.resolve()
                        })
                })
            )

            return streams.filter(stream => stream)
        }
    } else if (config.DebridProvider == "Premiumize") {
        const torrents = await Premiumize.searchFiles(apiKey, searchKey, searchThreshold)
        if (torrents && torrents.length) {
            const streams = await Promise.all(torrents
                .filter(torrent => filterSeason(torrent, season))
                .map(torrent => {
                    return Premiumize.getTorrentDetails(apiKey, torrent.id)
                        .then(torrentDetails => {
                            if (filterEpisode(torrentDetails, season, episode)) {
                                return toStream(torrentDetails, type)
                            }
                        })
                        .catch(err => {
                            console.log(err)
                            Promise.resolve()
                        })
                })
            )

            return streams.filter(stream => stream)
        }
    } else {
        return Promise.reject(BadRequestError)
    }

    return []
}

async function resolveUrl(debridProvider, debridApiKey, hostUrl) {
    if (debridProvider == "DebridLink" || debridProvider == "Premiumize") {
        return hostUrl
    } else if (debridProvider == "RealDebrid") {
        return RealDebrid.unrestrictUrl(debridApiKey, hostUrl)
    } else if (debridProvider == "AllDebrid") {
        return AllDebrid.unrestrictUrl(debridApiKey, hostUrl)
    } else {
        return Promise.reject(BadRequestError)
    }
}

function filterSeason(torrent, season) {
    return torrent && torrent.info.season == season
}

function filterEpisode(torrentDetails, season, episode) {
    torrentDetails.videos = torrentDetails.videos
        .filter(video => (season == video.info.season) && (episode == video.info.episode))

    return torrentDetails.videos && torrentDetails.videos.length
}

function filterYear(torrent, metadataDetails) {
    if (torrent && torrent.info.year && metadataDetails) {
        return torrent.info.year == metadataDetails.year
    }

    return true
}

function filterDownloadEpisode(download, season, episode) {
    return download && download.info.season == season && download.info.episode == episode
}

function toStream(details, type) {
    let video, icon
    if (details.fileType == FILE_TYPES.DOWNLOADS) {
        icon = '⬇️'
        video = details
    } else {
        icon = '💾'
        video = details.videos.sort((a, b) => b.size - a.size) && details.videos[0]
    }
    let title = details.name
    if (type == 'series') {
        title = title + '\n' + video.name
    }
    title = title + '\n' + icon + ' ' + formatSize(video.size)

    let name = STREAM_NAME_MAP[details.source]
    name = name + '\n' + video.info.resolution

    let bingeGroup = details.source + '|' + details.id

    return {
        name,
        title,
        url: video.url,
        behaviorHints: {
            bingeGroup: bingeGroup
        }
    }
}

function formatSize(size) {
    if (!size) {
        return undefined
    }

    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024))
    return Number((size / Math.pow(1024, i)).toFixed(2)) + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i]
}

export default { getMovieStreams, getSeriesStreams, resolveUrl }