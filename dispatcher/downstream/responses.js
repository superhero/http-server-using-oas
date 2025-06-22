export function locate(locator)
{
  const oas = locator('@superhero/oas')
  return new ResponsesMiddleware(oas)
}

export default class ResponsesMiddleware
{
  constructor(oas)
  {
    this.oas = oas
  }

  async dispatch(request, session)
  {
    await session.chain.next()

    if(false === !!session.abortion.signal.aborted)
    {
      const 
        status    = session.view.status,
        responses = session.route.operation.responses

      if(status in responses)
      {
        this.oas.responses.conform(responses[status], session.view)
      }
      else
      {
        const error = new Error(`Invalid status code: ${status}`)
        error.code  = 'E_OAS_INVALID_RESPONSE_STATUS'
        error.cause = `The operation supports status codes: ${Object.keys(responses).join(', ')}`
        throw error
      }
    }
  }

  onError(reason, request, session)
  {
    const error   = new Error(`Invalid response for operation ${request.method} ${request.url}`)
    error.code    = 'E_OAS_INVALID_RESPONSE'
    error.status  = 400
    error.cause   = reason
    session.abortion.abort(error)
  }
}