export function locate(locator)
{
  const router = locator.locate('@superhero/http-server-using-oas')
  return new OasToRoutes(router)
}

export default class OasToRoutes
{
  constructor(router)
  {
    this.router = router
  }

  bootstrap()
  {
    for(const [ path, operations ] of Object.entries(this.oas.specification.paths))
    {
      for(const [ method, operation ] of Object.entries(operations))
      {
        const dispatcher = operation['operationId'] ?? operation['x-dispatcher']

        if('string' === typeof dispatcher)
        {
          this.router.setOasRoute(path, method, dispatcher, operation['x-middlewares'] ?? [])
        }
      }
    }
  }
}