/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const debug = require('debug')('aio-lib-core-ims-oauth/login')
const ora = require('ora')
const { cli } = require('cli-ux')
const { randomId, authSiteUrl, createServer, getQueryDataFromRequest, stringToJson } = require('./helpers')

const AUTH_TIMEOUT_SECONDS = 120
const AUTH_URL = 'https://adobeioruntime.net/api/v1/web/53444_51636/default/appLogin/'

/**
 * Gets the access token / auth code for a signed in user.
 *
 * @param {object} options the optional configuration
 * @param {number} [options.timeout] the timeout in seconds
 * @param {string} [options.client_id] the client id of the OAuth2 integration
 * @param {string} [options.scope] the scope of the OAuth2 integration
 * @param {string} [options.redirect_uri] the redirect uri of the OAuth2 integration
 */
async function login (options) {
  // eslint-disable-next-line camelcase
  const { timeout = AUTH_TIMEOUT_SECONDS, client_id, scope, redirect_uri } = options
  const id = randomId()
  const server = await createServer()
  const serverPort = server.address().port
  const uri = authSiteUrl(AUTH_URL, { id, port: serverPort, client_id, scope, redirect_uri })

  debug(`Local server created on port ${serverPort}.`)

  return new Promise((resolve, reject) => {
    console.log('Visit this url to log in: ')
    cli.url(uri, uri)
    cli.open(uri)
    const spinner = ora('Logging in').start()

    const timerId = setTimeout(() => {
      reject(new Error(`Timed out after ${timeout} seconds.`))
      spinner.stop()
    }, timeout * 1000)

    server.on('request', (request, response) => {
      const queryData = getQueryDataFromRequest(request)
      debug(`queryData: ${JSON.stringify(queryData, null, 2)}`)
      const state = stringToJson(queryData.state)
      debug(`state: ${JSON.stringify(state)}`)

      if (queryData.code && state.id === id) {
        spinner.info(`Got ${queryData.code_type}`)
        clearTimeout(timerId)
        resolve(queryData.code)
      } else {
        clearTimeout(timerId)
        reject(new Error(`error code=${queryData.code}`))
      }

      response.statusCode = 200
      response.setHeader('Content-Type', 'text/plain')
      response.end('You are now signed in, please close this window.\n')

      server.close()
    })
  })
}

module.exports = login
