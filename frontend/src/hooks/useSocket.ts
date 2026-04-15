import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)

  if (!socketRef.current) {
    socketRef.current = io(BASE_URL, { autoConnect: false })
  }

  useEffect(() => {
    const socket = socketRef.current!
    socket.connect()
    return () => { socket.disconnect() }
  }, [])

  return socketRef.current
}
