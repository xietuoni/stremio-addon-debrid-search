#!/usr/bin/env node

import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import serverless from './serverless.js'
import requestIp from 'request-ip'
import rateLimit from 'express-rate-limit'
import swStats from 'swagger-stats'
import addonInterface from "./addon.js"

const app = express()
app.enable('trust proxy')
app.use(cors())

app.use(swStats.getMiddleware({
    name: addonInterface.manifest.name,
    version: addonInterface.manifest.version,
    timelineBucketDuration: 60 * 60 * 1000,
    apdexThreshold: 2000,
    authentication: true,
    onAuthenticate: (req, username, password) => {
        return ((username === process.env.SWAGGER_USER
            && (password === process.env.SWAGGER_PASSWORD)))
    },
}))

const rateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hours
    limit: 300, // Limit each IP to 300 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => requestIp.getClientIp(req)
})
app.use(rateLimiter)

const port = process.env.PORT || 55771;

app.use((req, res, next) => serverless(req, res, next))
app.listen(port, () => {
    console.log(`Started addon at: http://127.0.0.1:${port}`)
})

// https://stremio.github.io/stremio-publish-addon/index.html
// publishToCentral("https://68d69db7dc40-stremio-addon-debrid-search.baby-beamup.club/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md
