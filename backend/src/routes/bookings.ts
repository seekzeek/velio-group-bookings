import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import type { BookingService } from '../modules/booking/booking.js'
import { requireUser } from './identity.js'

const bookingBody = z.object({
  idempotencyKey: z.string().min(8).max(128),
  platform: z.enum(['web', 'mobile']).optional(),
  anonId: z.string().min(8).max(64).optional(),
})

export function createBookingRoutes(service: BookingService) {
  const activityBookings = Router({ mergeParams: true })
  const bookings = Router()

  activityBookings.post('/', async (req, res) => {
    const user = await requireUser(prisma, req)
    const activityId = z.uuid().parse((req.params as { id?: string }).id)
    const body = bookingBody.parse(req.body)
    const result = await service.bookSpot(prisma, { activityId, userId: user.id, ...body })
    res.status(result.replayed ? 200 : 201).json(result)
  })

  bookings.post('/:id/cancel', async (req, res) => {
    const user = await requireUser(prisma, req)
    const bookingId = z.uuid().parse(req.params.id)
    res.json(await service.cancelBooking(prisma, { bookingId, userId: user.id }))
  })

  return { activityBookings, bookings }
}
