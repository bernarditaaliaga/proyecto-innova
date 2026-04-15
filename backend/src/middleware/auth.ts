import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface TokenPayload {
  id: number
  rol: 'profesora' | 'alumno'
  salaId?: number
}

export interface AuthRequest extends Request {
  usuario?: TokenPayload
}

export function verificarToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload
    req.usuario = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
}

export function soloProfesor(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.usuario?.rol !== 'profesora') {
    res.status(403).json({ error: 'Solo profesoras pueden hacer esto' })
    return
  }
  next()
}
