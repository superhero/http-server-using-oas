export async function locate(locator)
{
  const
    server  = locator.locate('@superhero/http-server'),
    oas     = locator.locate('@superhero/oas')

  return new HttpServerUsingOas(server, oas)
}

/** 
 * A class that integrates the HTTP server and OAS (OpenAPI Specification) components.
 * Use the service to set routes based off the configiured OAS specifications.
 */
export default class HttpServerUsingOas
{
  /**
   * @param {@superhero/http-server} server - The HTTP server instance.
   * @param {@superhero/oas} oas - The OpenAPI Specification instance.
   */
  constructor(server, oas)
  {
    this.server = server
    this.oas    = oas
  }

  /**
   * Set a route by mapping an OpenAPI operation to a dispatcher.
   * 
   * @param {string} path - The operation to validate.
   * @param {string} method - The HTTP method of the operation.
   * @param {string} dispatcher - The dispatcher to handle the operation.
   * @param {Array<string>} [middlewares=[]] - Optional middlewares to apply to the route.
   * 
   * @throws {TypeError}  - E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_PATH
   * @throws {TypeError}  - E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_METHOD
   * @throws {TypeError}  - E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_DISPATCHER
   * @throws {Error}      - E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_OPERATION
   * @throws {Error}      - E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_CONTENT_TYPE
   */
  setOasRoute(path, method, dispatcher, middlewares = [])
  {
    if('string' !== typeof path)
    {
      const error = new TypeError(`The path must be a string, received ${typeof path}`)
      error.code  = 'E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_PATH'
      throw error
    }

    if('string' !== typeof method)
    {
      const error = new TypeError(`The method must be a string, received ${typeof method}`)
      error.code  = 'E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_METHOD'
      throw error
    }

    if(false === !!dispatcher)
    {
      const error = new TypeError(`The dispatcher must be set when setting an OAS route`)
      error.code  = 'E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_DISPATCHER'
      throw error
    }

    method = method.toLowerCase()

    const route = { dispatcher, conditions:[], middlewares:[] }
    let operation

    try
    {
      operation = this.oas.specification.paths[path][method]
      this.oas.validateOperation(operation)
      operation = this.oas.denormalizeOperation(operation)
    }
    catch(reason)
    {
      const error = new Error(`Invalid method "${method}" in path "${path}"`)
      error.code  = 'E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_OPERATION'
      error.cause = reason
      throw error
    }

    route['condition.method'] = method
    route.conditions.push('@superhero/http-server/condition/upstream/method')

    if(operation.requestBody?.content)
    {
      const supportedContentTypes     = Object.keys(operation.requestBody.content)
      route['condition.content-type'] = supportedContentTypes

      for(const supportedContentType of supportedContentTypes)
      {
        route['content-type.' + supportedContentType] = this.requestBodyContentTypeRouteMap(supportedContentType)
      }

      route.conditions.push('@superhero/http-server/condition/upstream/header/content-type')
      route.middlewares.push('@superhero/http-server/dispatcher/upstream/header/content-type')
    }

    route.condition = path.replace(/\{([^}]+)\}/g, ':$1')
    route.middlewares.push('@superhero/http-server-using-oas/dispatcher/upstream/parameters')
    route.middlewares.push('@superhero/http-server-using-oas/dispatcher/upstream/request-bodies')
    route.middlewares.push('@superhero/http-server-using-oas/dispatcher/downstream/responses')
    route.middlewares.push(...[middlewares].flat())

    Object.defineProperty(route, 'operation', { value: operation })

    this.server.router.set(`${method} ${path}`, route)
  }

  /**
   * Returns a middleware that can be used to resolve the content-type of the request-body.
   * 
   * @param {string} supportedContentType - The content type to map.
   * @returns {string} - The middleware path to handle the request body content-type.
   * 
   * @throws {Error} - E_OAS_UNSUPPORTED_CONTENT_TYPE
   */
  requestBodyContentTypeRouteMap(supportedContentType)
  {
    switch(supportedContentType)
    {
      case 'application/json': 
      {
        return '@superhero/http-server/dispatcher/upstream/header/content-type/' + supportedContentType
      }
      default:
      {
        const error = new Error(`Unsupported content type "${supportedContentType}" in request body`)
        error.code  = 'E_HTTP_SERVER_USING_OAS_SET_ROUTE_INVALID_CONTENT_TYPE'
        error.cause = `For the moment, the only request body supported has content-type: "application/json"`
        throw error 
      }
    }
  }
}