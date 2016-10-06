'use strict'
console.time('scraping')
const request = require('request')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const fs = require('fs')
const Promise = require('bluebird')
const os = require('os')
const _ = require('lodash')

const URL = 'http://www.directorioturistampa.com/directorio.html?offset=0&accion=despliega_ciudades&categoria=AGENCIA%20DE%20VIAJES&subcategoria=&ID_ESTADO=9'

function processInput (text) {
  fs.open('./agency.cvs', 'a', 666, function (e, id) {
    fs.write(id, text + os.EOL, null, 'utf8', function () {
      fs.close(id, function () {
        return
      })
    })
  })
}

function getLink (links) {
  let result = [URL]

  for (let key in links) {
    let active = links[key]
    let attr = _.get(active, 'attribs.href', '')

    if (attr.includes('offset')) {
      result.push(encodeURI(`http://www.directorioturistampa.com/${attr}`))
    }
  }

  return _.uniq(result)
}

function getLinkDescription (boxes, $) {
  let result = []

  for (let key in boxes) {
    const box = boxes[key]
    if (_.get(box, 'children[0].name') === 'b') {
      // console.warn(box.children[0].children[1].data)
      // console.log()
      let preview = $(box).find('a')[0].attribs.href
      result.push(encodeURI(`http://www.directorioturistampa.com/${preview}`))
    }
  }

  return result
}

function gesDescription (link) {
  return new Promise((resolve, reject) => {
    request({
      uri: link,
      encoding: null
    }, function (error, response, html) {
      if (error) return reject(error)
      console.log(`Get info by ${link} ...`)

      const utf8String = iconv.decode(new Buffer(html), 'ISO-8859-1')
      const $agency = cheerio.load(utf8String)
      const table = $agency('table')
      const title = $agency("font[size='3']").html()
      const website = _.get($agency('.longazul')[1], 'attribs.href')
      const desc = $agency(table[6]).text().replace(/\s\s+/g, ' ')

      const result = {
        title: title,
        website: website,
        desc: desc
      }

      processInput(`${title}|${website}|${desc}`)
      resolve(result)
    })
  })
}

function openLink (link) {
  return new Promise((resolve, reject) => {
    request(link, function (error, response, html) {
      if (error) return reject(error)
      const $ = cheerio.load(html)
      const content = $('body > table tr td div')
      const boxes = $(content).find('p')
      const descLink = getLinkDescription(boxes, $)
      const promiseResultArray = Promise.mapSeries(descLink, gesDescription)

      promiseResultArray.then((results) => {
        resolve(results)
      })
    })
  })
}

request(URL, function (error, response, html) {
  if (error) return console.error(error)
  const $ = cheerio.load(html)
  const content = $('body > table tr td div')
  const links = $(content).find('a')
  const navLink = getLink(links)
  const promiseResultArray = Promise.mapSeries(navLink, openLink)

  promiseResultArray.then((results) => {
    console.timeEnd('scraping')
  })
})
