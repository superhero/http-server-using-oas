export function locate(locator)
{
  const specification = locator.config.find('oas')
  return new OptionsDispatcher(specification)
}

export default class OptionsDispatcher
{
  constructor(specification)
  {
    this.specification = specification
  }

  dispatch(request, session)
  {
    const [ validResource, ...validOperations ] = session.route.operation.operationId.split('#')
    const
      output        = {},
      components    = {},
      paths         = {},
      parameters    = {},
      requestBodies = {},
      responses     = {},
      schemas       = {},
      depth         = request.url.pathname.split('/').length

    // Loop through all paths in the OpenAPI Specification and find the ones that 
    // match the defined operation, or the beginning of the request path if no operation is defined...
    for(const path in this.specification.paths || {})
    {
      let valid = false

      // validate the path depending on if the operation-id specify a specific operation, or not...
      if(validResource)
      {
        valid = validResource === path
      }
      // validate the beginning of the request path if no specific operation is defined...
      else
      {
        const
          partial = path.split('/').slice(0, depth).join('/'),
          regexp  = partial.replace(/{[^}]+}/g, '([^/]*)')

        valid = new RegExp(`^${regexp}$`).test(request.url.pathname)
      }

      // Only include a scoped version of the specification
      if(valid)
      {
        paths[path] = { ...this.specification.paths[path] }

        // Operations
        for(let method in paths[path])
        {
          const lowerCasedMethod = method.toLowerCase()

          switch(lowerCasedMethod)
          {
            case 'get':
            case 'put':
            case 'post':
            case 'delete':
            case 'options':
            case 'head':
            case 'patch':
            case 'trace':
            {
              if(validOperations.langth === 0 // if not specified, then not concidered restrictive...
              || validOperations.map(validMethod => validMethod.toLowerCase()).includes(lowerCasedMethod))
              {
                // break to proceed to process
                break
              }
              else
              {
                // hide restricted methods
                delete paths[path][method]
                continue
              }
            }
            default:
            {
              // ignore any non HTTP method
              continue
            }
          }

          const operation = paths[path][method]

          // Parameters
          for(let parameter of operation.parameters || [])
          {
            parameter = this.#augment(parameters, parameter.$ref) || parameter
            // Parameters - schemas
            this.#augmentSchemasRecursively(schemas, parameter.schema)
          }

          // Request Bodies
          let 
          requestBody = operation.requestBody || {}
          requestBody = this.#augment(requestBodies, requestBody.$ref) || requestBody
          this.#augment(requestBodies, requestBody.$ref)
          // Request Bodies - schemas
          for(const contentType in requestBody.content || {})
          {
            this.#augmentSchemasRecursively(schemas, operation.requestBody.content[contentType].schema)
          }

          // Responses
          for(const status in operation.responses || {})
          {
            let
            response = operation.responses[status] || {}
            response = this.#augment(responses, response.$ref) || response
            // Responses - schemas
            for(const contentType in response.content || {})
            {
              this.#augmentSchemasRecursively(schemas, response.content[contentType].schema)
            }
          }
        }
      }
    }

    // Aport with a 404 error if no paths were found in the specification
    if(false === Object.keys(paths).length)
    {
      const error  = new Error(`No endpoints found matching the requested path "${request.url.pathname}"`)
      error.code   = 'E_OAS_NO_ENDPOINTS_FOUND'
      error.status = 404
      return session.abortion.abort(error)
    }

    output.openapi  = this.specification.openapi
    output.info     = this.specification.info
    output.paths    = paths

    if(Object.keys(parameters)    .length)  components.parameters     = parameters
    if(Object.keys(requestBodies) .length)  components.requestBodies  = requestBodies
    if(Object.keys(responses)     .length)  components.responses      = responses
    if(Object.keys(schemas)       .length)  components.schemas        = schemas
    if(Object.keys(components)    .length)  output.components         = components

    this.view.body = output
  }

  #augment(component, ref)
  {
    // only augment if the reference is defined
    if('string' !== typeof ref) return

    const [ uri, pointer ] = ref.split('#')

    // only augment local references
    if(true === !!uri) return

    // component name
    const name = pointer.split('/').pop()

    // avoid redundant traversals and augmentations
    if(name in component) return

    // augment the component with the branch at the traversed pointer in the specification
    const traversePath = pointer.split('/').filter(Boolean)
    return component[name] = traversePath.reduce((obj, key) => obj && obj[key], this.specification)
  }

  #augmentSchemasRecursively(component, schema)
  {
    // avoid undefined schemas
    if(false === !!schema) return
    // loop through the schemas if it is an array
    if(Array.isArray(schema)) return schema.forEach(schema => this.#augmentSchemasRecursively(component, schema))
    // replace the schema with the augmented one, if the schema defined a reference
    if(schema.$ref) schema = this.#augment(component, schema.$ref)
    // avoid redundant processing
    if(false === !!schema) return

    this.#augmentSchemasRecursively(component, Object.values(schema.properties || {}))
    this.#augmentSchemasRecursively(component, schema.additionalProperties)
    this.#augmentSchemasRecursively(component, schema.propertyNames)
    this.#augmentSchemasRecursively(component, schema.items)
    this.#augmentSchemasRecursively(component, schema.allOf)
    this.#augmentSchemasRecursively(component, schema.anyOf)
    this.#augmentSchemasRecursively(component, schema.oneOf)
    this.#augmentSchemasRecursively(component, schema.if)
    this.#augmentSchemasRecursively(component, schema.not)
    this.#augmentSchemasRecursively(component, schema.then)
    this.#augmentSchemasRecursively(component, schema.else)
  }

  onError(reason, _, session)
  {
    const error  = new Error(`Server error occured while attempting to declare API options`)
    error.code   = 'E_OAS_INVALID_REQUEST_PARAMETERS'
    error.cause  = reason
    error.status = 500
    session.abortion.abort(error)
  }
}