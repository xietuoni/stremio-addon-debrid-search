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
    return res["movie_results"][0]['id']
  } else if (type == "series") {
    return res["tv_results"][0]['id']
  }
  throw new Error("IMDB ID not Found")
}

async function getDetails(type, tmdbId, tmdbAPIKey, season) {
  var tmdbType = type
  if (type == "series") {
    tmdbType = 'tv'
  }
  const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?append_to_response=translations%2Calternative_titles&language=en-US&api_key=${tmdbAPIKey}`;

  const res = await dispatch(url)


  var title_in_original_language = ""
  if (type == "movie") {
    title_in_original_language = res["original_title"]
  } else if (type == "series") {
    title_in_original_language = res["original_name"]
  }

  var names =
    res['translations']['translations'].map((x) => {
      const lang = x["iso_639_1"]
      const country = x["iso_3166_1"]
      var title = x["data"]['name']

      //TMDB does not give translation in the original language 
      if (!title && lang == res["original_language"]) {
        title = title_in_original_language
      }

      return [lang, country, [title]]
    })


  res['alternative_titles']['results'].forEach((x) => {
    const alternative_titles_country = x["iso_3166_1"]
    const alternative_title = x['title']
    const alternative_season = x['type']

    var season_matches = true
    if (type == "series" && season && alternative_season) {
      season_matches = (("season " + season) === alternative_season)
    }

    if (!season_matches)
      return

    // This is not always accurate, the country may speak more than 1 language.
    names.forEach((x) => {
      const [lang, country, titles] = x
      if (country == alternative_titles_country) {
        titles.push(alternative_title)
      }
    })

  })

  var names_map = new Map()
  names.forEach((x) => {
    var [lang, country, titles] = x
    const key = lang + "-" + country
    titles = [...new Set(titles)];

    if (titles) {
      names_map.set(key, titles)
    }
  })

  var date = ""
  if (type == "movie") {
    date = res["release_date"]
  } else if (type == "series") {
    date = res["first_air_date"]
  }

  var year = ""
  if (date) {
    year = date.slice(0, 4);
  }

  return {
    'names': names_map,
    'year': year
  }

}

async function getMeta(type, imdbId, tmdbAPIKey, season) {
  const tmdbId = await getTMDBId(type, imdbId, tmdbAPIKey)
  const meta = await getDetails(type, tmdbId, tmdbAPIKey, season)
  return meta

}

export default { getMeta }