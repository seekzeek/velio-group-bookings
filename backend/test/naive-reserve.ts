import { setTimeout as sleep } from 'node:timers/promises'
import { AppError } from '../src/errors.js'
import type { ReserveFn } from '../src/modules/booking/reserve.js'

// The broken version: read the count, pause, write count + 1. Two requests that read the same count both write the same number.
// Only used by the concurrency test, to prove the test would catch an implementation like this.
export const reserveSpotNaive: ReserveFn = async (tx, input) => {
  const activity = await tx.activity.findUniqueOrThrow({ where: { id: input.activityId } })
  if (activity.spotsTaken >= activity.capacity) throw new AppError('SOLD_OUT')
  await sleep(25)
  await tx.activity.update({ where: { id: activity.id }, data: { spotsTaken: activity.spotsTaken + 1, version: activity.version + 1 } })
  const plan = await tx.plan.create({ data: { activityId: activity.id, ownerId: input.userId } })
  const booking = await tx.booking.create({ data: { activityId: activity.id, planId: plan.id, userId: input.userId, idempotencyKey: input.idempotencyKey } })
  return {
    booking,
    planId: plan.id,
    counts: { spotsTaken: activity.spotsTaken + 1, capacity: activity.capacity, spotsLeft: activity.capacity - activity.spotsTaken - 1, version: activity.version + 1 },
  }
}
