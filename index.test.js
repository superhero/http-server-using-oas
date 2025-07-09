import Core     from '@superhero/core'
import Request  from '@superhero/http-request'
import assert   from 'node:assert'
import util     from 'node:util'
import { suite, test, beforeEach } from 'node:test'

util.inspect.defaultOptions.depth = 3

suite('@superhero/http-server-using-oas', () => 
{
  let core

  beforeEach(async () => 
  {
    if(beforeEach.skip)
    {
      return
    }

    if(core)
    {
      await core.destroy()
    }

    core = new Core()
    await core.add('@superhero/oas')
    await core.add('@superhero/http-server')
    await core.add('@superhero/http-server-using-oas')

    core.locate.set('placeholder', { dispatch: () => 'placeholder' })
  })

  test('Can set a simple specification', async () => 
  {
    const specification = 
      { paths:
        { '/foo': 
          { get:  { responses: { 200: {} }},
            post: { responses: { 200: {} }}
          },
          '/bar':
          { put:  { responses: { 200: {} }} }}}

    core.locate.config.assign({ oas:specification })

    await core.bootstrap()

    const oas = core.locate('@superhero/http-server-using-oas')
    oas.setOasRoute('/foo', 'get',  'placeholder')
    oas.setOasRoute('/foo', 'post', 'placeholder')
    oas.setOasRoute('/bar', 'put',  'placeholder')

    assert.ok(oas.server.router.has('get /foo'),  'Route for "get /foo" should be added')
    assert.ok(oas.server.router.has('post /foo'), 'Route for "post /foo" should be added')
    assert.ok(oas.server.router.has('put /bar'),  'Route for "put /bar" should be added')
  })

  test('Can add middleware for requestBody content', async () => 
  {
    const specification =
      { paths:
        { '/foo':
          { post:
            { requestBody : { content: { 'application/json': {} } },
              responses   : { 200: {} } }}}}

    core.locate.config.assign({ oas:specification })
    await core.bootstrap()
    const oas = core.locate('@superhero/http-server-using-oas')
    
    oas.setOasRoute('/foo', 'post', 'placeholder')

    const
      route                 = oas.server.router.get('post /foo'),
      requestBodyMiddleware = core.locate('@superhero/http-server-using-oas/dispatcher/upstream/request-bodies'),
      hasRequestBodies      = route.route.middlewares.includes(requestBodyMiddleware)

    assert.ok(hasRequestBodies, 'Middleware for requestBody should be added')
    assert.equal(
      route.route['content-type.application/json'],
      '@superhero/http-server/dispatcher/upstream/header/content-type/application/json')
  })

  test('Can add middleware for parameters', async () => 
  {
    const specification = 
      { paths: 
        { '/foo': 
          { get: 
            { parameters  : [],
              responses   : { 200: {} } }}}}

    core.locate.config.assign({ oas:specification })
    await core.bootstrap()
    const oas = core.locate('@superhero/http-server-using-oas')

    oas.setOasRoute('/foo', 'get', 'placeholder')

    const
      route                 = oas.server.router.get('get /foo'),
      parametersMiddleware  = core.locate('@superhero/http-server-using-oas/dispatcher/upstream/parameters'),
      hasParameters         = route.route.middlewares.includes(parametersMiddleware)

    assert.ok(hasParameters, 'Middleware for parameters should be added')
  })

  test('Specification with reference to components', async sub => 
  {
    const specification =
      { components:
        { headers:
          { ContentType: 
            { required: true, 
              schema: { type: 'string' }
            }
          },
          parameters:
          { DefaultFoo:   { name: 'foo', in: 'query',  required: true,  schema: { '$ref': '#/components/schemas/String' }, nullable: true, default: null },
            RequiredFoo:  { name: 'foo', in: 'query',  required: true,  schema: { '$ref': '#/components/schemas/String' }},
            PathFoo:      { name: 'foo', in: 'path',   required: true,  schema: { '$ref': '#/components/schemas/String' }},
            QueryFoo:     { name: 'foo', in: 'query',  required: false, schema: { '$ref': '#/components/schemas/String' }},
            HeaderFoo:    { name: 'foo', in: 'header', required: false, schema: { '$ref': '#/components/schemas/String' }}
          },
          requestBodies:
          { ExampleRequestBody: { '$ref': '#/components/requestBodies/GenericRequestBody' },
            GenericRequestBody:
            { required: true,
              content: { 'application/json': { schema: { '$ref': '#/components/schemas/Foo' }}}
            }
          },
          responses:
          { SuccessResult:
            { description: 'Successful result',
              headers: { 'Content-Type': { '$ref': '#/components/headers/ContentType' }},
              content: { 'application/json': { schema: { '$ref': '#/components/schemas/Result' }}}
            },
            BadRequest:
            { description: 'Bad Request',
              content: { 'application/json': { schema: { '$ref': '#/components/schemas/Result' }}}
            }
          },
          schemas:
          { String: { type: 'string' },
            Foo:
            { type: 'object',
              properties: { foo: { '$ref': '#/components/schemas/String' }}
            },
            Result:
            { type: 'object',
              properties: { result: { '$ref': '#/components/schemas/String' } }
            }
          }
        },
        paths:
        { '/example/default':
          { get:
            { parameters: [{ '$ref': '#/components/parameters/DefaultFoo' }],
              responses:
              { 200: { '$ref': '#/components/responses/SuccessResult' },
                400: { '$ref': '#/components/responses/BadRequest' }
              }
            }
          },
          '/example/required':
          { get:
            { parameters: [{ '$ref': '#/components/parameters/RequiredFoo' }],
              responses:
              { 200: { '$ref': '#/components/responses/SuccessResult' },
                400: { '$ref': '#/components/responses/BadRequest' }
              }
            }
          },
          '/example/foo/{foo}':
          { get:
            { parameters: [{ '$ref': '#/components/parameters/PathFoo' }],
              responses:
              { 200: { '$ref': '#/components/responses/SuccessResult' },
                400: { '$ref': '#/components/responses/BadRequest' }
              }
            }
          },
          '/example':
          { get:
            { parameters:
              [ { '$ref': '#/components/parameters/QueryFoo'  },
                { '$ref': '#/components/parameters/HeaderFoo' }
              ],
              responses:
              { 200: { '$ref': '#/components/responses/SuccessResult' },
                400: { '$ref': '#/components/responses/BadRequest' }
              }
            },
            post:
            { requestBody: { '$ref': '#/components/requestBodies/ExampleRequestBody' },
              responses:
              { 200: { '$ref': '#/components/responses/SuccessResult' },
                400: { '$ref': '#/components/responses/BadRequest' }}}}
              }
            }

    core.locate.config.assign({ oas:specification })
    await core.bootstrap()
    const oas = core.locate('@superhero/http-server-using-oas')
    const
      dispatcher1 = { dispatch: (request, session) => session.view.body.result = request.param.foo },
      dispatcher2 = { dispatch: (request, session) => session.view.body.result = request.body.foo  }

    core.locate.set('test/dispatcher/1', dispatcher1)
    core.locate.set('test/dispatcher/2', dispatcher2)

    oas.setOasRoute('/example',           'get',  'test/dispatcher/1')
    oas.setOasRoute('/example',           'post', 'test/dispatcher/2')
    oas.setOasRoute('/example/foo/{foo}', 'get',  'test/dispatcher/1')
    oas.setOasRoute('/example/required',  'get',  'placeholder')
    oas.setOasRoute('/example/default',   'get',  'placeholder')

    const
      route                     = oas.server.router.get('get /example'),
      parametersMiddleware      = core.locate('@superhero/http-server-using-oas/dispatcher/upstream/parameters'),
      requestBodiesMiddleware   = core.locate('@superhero/http-server-using-oas/dispatcher/upstream/request-bodies'),
      responsesMiddleware       = core.locate('@superhero/http-server-using-oas/dispatcher/downstream/responses')

    assert.ok(route, 'route for "get /example" should exist')
    assert.ok(route.route.middlewares.includes(parametersMiddleware))
    assert.ok(route.route.middlewares.includes(requestBodiesMiddleware))
    assert.ok(route.route.middlewares.includes(responsesMiddleware))

    assert.equal(route.route['condition.method'], 'get', 'Correct GET method condition')

    const httpServer = core.locate('@superhero/http-server')
    await httpServer.listen()

    beforeEach.skip = true

    await sub.test('GET method using default parameter query parameter', async () =>
    {
      const
        baseUrl   = `http://localhost:${httpServer.gateway.address().port}`,
        request   = new Request({ url: baseUrl, doNotThrowOnErrorStatus: true }),
        response  = await request.get({ url: '/example/default?foo=query', headers: { 'connection': 'close', 'content-type': 'application/json' }})

      assert.equal(response.status, 200, '200 status code for GET method')
      assert.equal(response.body.result, null, 'Correct response body for GET method')
    })

    await sub.test('GET method not using required parameter', async () =>
    {
      const
        baseUrl   = `http://localhost:${httpServer.gateway.address().port}`,
        request   = new Request({ url: baseUrl, doNotThrowOnErrorStatus: true }),
        response  = await request.get({ url: '/example/required', headers: { 'connection': 'close', 'content-type': 'application/json' }})

      assert.equal(response.status, 400, '400 status code for GET method')
    })

    await sub.test('GET method using bar parameter', async () =>
    {
      const
        baseUrl   = `http://localhost:${httpServer.gateway.address().port}`,
        request   = new Request({ url: baseUrl, doNotThrowOnErrorStatus: true }),
        response  = await request.get({ url: '/example/foo/bar', headers: { 'connection': 'close', 'content-type': 'application/json' }})

      assert.equal(response.status, 200, '200 status code for GET method')
      assert.equal(response.body.result, 'bar', 'Correct response body for GET method')
    })

    await sub.test('GET method using header parameter', async () =>
    {
      const
        baseUrl   = `http://localhost:${httpServer.gateway.address().port}`,
        request   = new Request({ url: baseUrl, doNotThrowOnErrorStatus: true }),
        response  = await request.get({ url: '/example', headers: { 'foo':'header', 'connection': 'close', 'content-type': 'application/json' }})

      assert.equal(response.status, 200, '200 status code for GET method')
      assert.equal(response.body.result, 'header', 'Correct response body for GET method')
    })

    await sub.test('POST method using request body', async () =>
    {
      const
        baseUrl   = `http://localhost:${httpServer.gateway.address().port}`,
        request   = new Request({ url: baseUrl, doNotThrowOnErrorStatus: true }),
        response  = await request.post({ url: '/example', body: { foo: 'body' }, headers: { 'connection': 'close', 'content-type': 'application/json' }})

      assert.equal(response.status, 200, '200 status code for POST method')
      assert.equal(response.body.result, 'body', 'Correct response body for POST method')
    })

    beforeEach.skip = false

    await httpServer.close()
  })
})
