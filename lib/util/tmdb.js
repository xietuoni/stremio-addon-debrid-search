import fetch from 'node-fetch'

async function dispatch(url) {
  const options = { method: 'GET', headers: { accept: 'application/json' } };

  return await fetch(url, options)
    .then(res => res.json())
    .catch(err => {
      console.error(err)
      throw new Error("Error from TMDB: " + JSON.stringify(err))
    });

}

async function getTMDBId(type, imdbId, tmdbAPIKey) {
  const url = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${tmdbAPIKey}`
  const res = await dispatch(url)
  if (type == "movie") {
    return res["movie_result"][0]
  } else if (type == "tv") {
    return res["tv_result"][0]
  }
  throw new Error("IMDB ID not Found")
}

async function getDetails(type, tmdbId, tmdbAPIKey) {
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?append_to_response=translations&language=en-US&api_key=${tmdbAPIKey}`;

  const res = await dispatch(url)
  var names =
    res['translations']['translations'].map((x) => {
      const lang = x["iso_639_1"] + '-' + x["iso_3166_1"]
      const title = x["data"]["name"]
      lang, title
    })
  names = Map(names)

  var date = ""

  if (type == "movie") {
    date = res["release_date"]
  } else if (type == "tv") {
    date = res["first_air_date"]
  }

  var year = ""
  if (date) {
    year = date.slice(0, 4);
  }

  return {
    'names': names,
    'year': year
  }

}

async function getMeta(type, imdbId, tmdbAPIKey) {
  const tmdbId = await getTMDBId(type, imdbId, tmdbAPIKey)
  const meta = await getDetails(type, tmdbId, tmdbAPIKey)
  return meta

}

export default { getMeta }