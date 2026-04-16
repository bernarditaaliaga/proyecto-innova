import { Router, Response } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { verificarToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Configurar Cloudinary desde variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Multer en memoria (no guarda archivos en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Formato no soportado. Usa JPG, PNG, GIF o WebP.'))
  }
})

// Subir imagen
router.post('/', verificarToken, upload.single('imagen'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No se recibió ningún archivo' })
    return
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    res.status(500).json({ error: 'Cloudinary no está configurado' })
    return
  }

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aprendia', resource_type: 'image' },
        (error, result) => {
          if (error) reject(error)
          else resolve(result as { secure_url: string })
        }
      )
      stream.end(req.file!.buffer)
    })

    res.json({ url: result.secure_url })
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[Upload] Error:', e.message)
    res.status(500).json({ error: 'Error al subir imagen' })
  }
})

export default router
