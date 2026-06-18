// SSE in-memory pub/sub hub

const subscribers = new Set()

export function subscribe(reply) {
  subscribers.add(reply)
  return function unsubscribe() {
    subscribers.delete(reply)
  }
}

export function publish(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const reply of subscribers) {
    try {
      reply.raw.write(payload)
    } catch {
      subscribers.delete(reply)
    }
  }
}

export function subscriberCount() {
  return subscribers.size
}
