<<<<<<< HEAD
<<<<<<< HEAD
const { spawn } = require('child_process')
const { request } = require('http')

const PORT = process.env.PORT || 5006

describe('getting started guide', () => {
  let app

  beforeEach(async () => {
    app = spawn('node', ['index.js'])
    app.stdout.on('data', (data) => console.log(data.toString()))
    // give the server a short time to start up
    return new Promise(resolve => setTimeout(resolve, 500))
  })

  afterEach(() => {
    if (app) {
      app.stdout.removeAllListeners()
      app.kill('SIGTERM')
    }
  })

  it('should bind to IPv4 and respond to GET /', async () => {
    const response = await get(`http://127.0.0.1:${PORT}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatch("<title>Node.js Getting Started on Heroku</title>")
    expect(response.body).toMatch("Getting Started on Heroku with Node.js")
  })

  it('should bind to IPv6 and respond to GET /', async () => {
    const response = await get(`http://[::1]:${PORT}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatch("<title>Node.js Getting Started on Heroku</title>")
    expect(response.body).toMatch("Getting Started on Heroku with Node.js")
  })
})

async function get(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, {method: 'GET'}, (res) => {
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', (data) => body += data)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body
        })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}
=======
const { spawn } = require('child_process');
=======
const { spawn } = require('child_process')
>>>>>>> bb7db3d (Some general improvements to the getting started guide (#347))
const { request } = require('http')

const PORT = process.env.PORT || 5006

describe('getting started guide', () => {
  let app

<<<<<<< HEAD
  // Wait until the server is ready
  child.stdout.on('data', _ => {
    // Make a request to our app
    (async () => {
      const response = await get('http://127.0.0.1:5001')
      // stop the server
      child.kill();
      // No error
      t.false(response.error);
      // Successful response
      t.equal(response.statusCode, 200);
      // Assert content checks
      t.notEqual(response.body.indexOf("<title>Node.js Getting Started on Heroku</title>"), -1);
      t.notEqual(response.body.indexOf("Getting Started on Heroku with Node.js"), -1);
    })();
  });
});
<<<<<<< HEAD
>>>>>>> b393814 (Add integration tests for CI (#78))
=======
=======
  beforeEach(async () => {
    app = spawn('node', ['index.js'])
    app.stdout.on('data', (data) => console.log(data.toString()))
    // give the server a short time to start up
    return new Promise(resolve => setTimeout(resolve, 500))
  })

  afterEach(() => {
    if (app) {
      app.stdout.removeAllListeners()
      app.kill('SIGTERM')
    }
  })

  it('should bind to IPv4 and respond to GET /', async () => {
    const response = await get(`http://127.0.0.1:${PORT}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatch("<title>Node.js Getting Started on Heroku</title>")
    expect(response.body).toMatch("Getting Started on Heroku with Node.js")
  })

  it('should bind to IPv6 and respond to GET /', async () => {
    const response = await get(`http://[::1]:${PORT}`)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatch("<title>Node.js Getting Started on Heroku</title>")
    expect(response.body).toMatch("Getting Started on Heroku with Node.js")
  })
})
>>>>>>> bb7db3d (Some general improvements to the getting started guide (#347))

async function get(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, {method: 'GET'}, (res) => {
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', (data) => body += data)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body
        })
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}
>>>>>>> 8330c7c (Fixes tests to work with updated dependencies (#316))
