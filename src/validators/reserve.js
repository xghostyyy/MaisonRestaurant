import { z } from 'zod'

export const ReserveSchema = z.object({
  guestName: z.string().min(2, 'Имя должно быть не короче 2 символов').max(100),
  guestPhone: z
    .string()
    .regex(/^\+?[\d\s\-() ]{7,20}$/, 'Введите корректный номер телефона'),
  guestEmail: z.string().email('Некорректный email').optional().or(z.literal('')),
  partySize: z.coerce
    .number({ invalid_type_error: 'Укажите количество гостей' })
    .int()
    .min(1, 'Минимум 1 гость')
    .max(20, 'Максимум 20 гостей'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Некорректное время'),
  tableId: z.string().optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const EditReservationSchema = z.object({
  guestName: z.string().min(2).max(100),
  guestPhone: z.string().regex(/^\+?[\d\s\-() ]{7,20}$/),
  guestEmail: z.string().email().optional().or(z.literal('')),
  partySize: z.coerce.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional().or(z.literal('')),
})
