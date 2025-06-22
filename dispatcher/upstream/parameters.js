export function locate(locator)
{
  const oas = locator('@superhero/oas')
  return new ParametersMiddleware(oas)
}

export default class ParametersMiddleware
{
  constructor(oas)
  {
    this.oas = oas
  }

  dispatch(request, session)
  {
    const parameters = session.route.operation.parameters

    if(parameters)
    {
      for(const parameter of parameters)
      {
        this.oas.parameters.conform(parameter, request)
      }
    }
  }

  onError(reason, request, session)
  {
    const error  = new Error(`Invalid request-parameters for operation ${request.method} ${request.url}`)
    error.code   = 'E_OAS_INVALID_REQUEST_PARAMETERS'
    error.cause  = reason
    error.status = 400
    session.abortion.abort(error)
  }
}