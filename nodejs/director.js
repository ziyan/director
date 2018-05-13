'use strict'

const dnsd = require('dnsd')
const fs = require('fs')
const path = require('path')

const domain = 'direct.ziyan.net'
const nameserver = 'ec2-jp-1.ziyan.net'
const admin = 'direct.ziyan.net'

const lookup_a = (fqdn, subdomains, answer) => {
  // name has to be in the format of ip-0-0-0-0.*
  if (subdomains.length != 2) {
    return answer()
  }

  // check for ip-0-0-0-0
  const parts = subdomains[0].split('-')
  if (parts.length != 5 || parts[0] != 'ip') {
    return answer()
  }

  // check that each part is an integer
  const ip = parts.slice(1)
  for (let part of ip) {
    if (!/[0-9]+/.test(part)) {
      return answer()
    }
    let int = parseInt(part)
    if (int < 0 || int > 255) {
      return answer()
    }
  }

  answer(ip.join('.'))
}

const lookup_txt = (fqdn, subdomains, answer) => {
  fs.readFile(path.join('data', `${fqdn}.txt`), {encoding: 'utf8'}, (error, data) => {
    if (error) {
      if (error.code != 'ENOENT') {
        console.log(`ERROR: failed to read file: ${fqdn}.txt: ${error}`)
      }
      return answer()
    }
    return answer(data ? data.trim() : '')
  })
}

const handler = (request, response) => {
  const question = request.question[0]
  const fqdn = question.name.toLowerCase()
  const answer = (data) => {
    console.log(`${request.connection.remoteAddress}: ${question.name} ${question.class} ${question.type}: ${data}`)
    if (data) {
      response.answer.push({
        name: question.name,
        class: question.class,
        type: question.type,
        data: data,
        ttl: 300,
      })
    }
    response.end()
  }

  if (!fqdn.endsWith(`.${domain}`)) {
    return answer()
  }

  const subdomains = fqdn.substr(0, fqdn.length - domain.length - 1).split('.')
  switch (question.kind()) {
    case 'IN A':
      return lookup_a(fqdn, subdomains, answer)
    case 'IN TXT':
      return lookup_txt(fqdn, subdomains, answer)
  }

  return answer()
}

const server = dnsd.createServer(handler)
server.zone(domain, nameserver, admin, 1, 7200, 900, 1209600, 300)	
server.listen(53)
