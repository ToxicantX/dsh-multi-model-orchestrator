import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const inject = ['llm', 'webServer', 'agents', 'commands']

export function apply(ctx) {
  const requests = []
  ctx.on('session/event', (_session, event) => {
    if (event.type === 'turn/end' && event.data.reason?.kind === 'error') {
      requests.push({ sessionId: _session.id, failure: event.data.reason.error })
    }
  })
  class ProbeAdapter extends LlmAdapter {
    async listModels() {
      return Array.from({ length: 5 }, (_, index) => ({ provider: 'smoke-provider', id: 'smoke-model-' + index, name: 'smoke-model-' + index }))
    }

    async *stream(options) {
      const { signal, ...request } = options
      requests.push(JSON.parse(JSON.stringify(request)))
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: 'Probe completed.' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Probe completed.' } }
      yield { type: 'finish', reason: 'stop' }
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['smoke-provider'], new ProbeAdapter()))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/plugins/orchestrator-smoke',
    async handler(req, res) {
      if (req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        const { sessionId } = JSON.parse(body)
        const agent = ctx.agents.get(sessionId)
        const result = await ctx.commands.execute(agent, '/plan', [], new AbortController().signal)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(result))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(requests))
    },
  }))
}
