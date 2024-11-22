import fetch from 'node-fetch'

async function getMeta(type, imdbId) {
    const meta =
        await fetch('https://v3-cinemeta.strem.io/meta/' + type + '/' + imdbId + '.json')
            .then(response => response.json())
            .then(body => body && body.meta)
            .catch(err => {
                console.log(err)
                throw new Error("Error from Cinemeta: " + JSON.stringify(err))
            })

    const names = new Map([['en-US', meta['name']]])
    return {
        'names': names,
        'year': meta['year']
    }
}

export default { getMeta }