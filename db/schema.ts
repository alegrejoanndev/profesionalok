import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Estado comercial del perfil (lo mueve el sistema de cobros). */
export const professionalStatus = pgEnum('professional_status', [
  'PENDING_PAYMENT', // completó el registro, todavía no pagó
  'ACTIVE', // suscripción al día
  'INACTIVE', // dado de baja (ver inactive_reason)
]);

/** Revisión manual del título/matrícula (la hace una persona del equipo desde /admin). */
export const verificationStatus = pgEnum('verification_status', ['PENDING', 'APPROVED', 'REJECTED']);

export const inactiveReason = pgEnum('inactive_reason', [
  'PAYMENT_FAILED', // débito automático rechazado
  'CANCELLED_BY_USER', // el profesional canceló o pausó desde Mercado Pago
  'ADMIN', // suspensión manual: el sistema de cobros NUNCA la revierte
  'LICENSE_INVALID', // el registro oficial informa que la matrícula ya no está habilitada (tampoco la revierte el cobro)
]);

/** Resultado de la validación automática de la matrícula contra el registro oficial (REFEPS). */
export const matriculaStatus = pgEnum('matricula_status', [
  'NOT_CHECKED', // todavía no se consultó (o la validación automática no está configurada)
  'VERIFIED', // coincide: persona, matrícula, profesión, provincia y habilitada
  'MISMATCH', // existe pero algún dato no coincide (nombre, profesión, provincia)
  'NOT_FOUND', // no figura en el registro
  'NOT_ENABLED', // figura pero NO está habilitada
  'UNAVAILABLE', // el servicio no respondió o rechazó las credenciales
]);

export const subscriptionStatus = pgEnum('subscription_status', [
  'PENDING', // checkout creado, sin autorizar
  'AUTHORIZED', // activa
  'PAST_DUE', // un cobro fue rechazado y Mercado Pago está reintentando
  'PAUSED',
  'CANCELLED',
]);

export const professionals = pgTable(
  'professionals',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull().unique(),
    email: text('email').notNull().unique(), // privado

    // Paso 1 del onboarding
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone').notNull(), // solo dígitos, formato internacional (ej: 5493482123456)
    profession: text('profession').notNull(), // slug de lib/professions.ts
    licenseType: text('license_type').notNull(), // 'MP' | 'MN' | 'RE'
    licenseNumber: text('license_number').notNull(),
    licenseProvince: text('license_province').notNull(), // jurisdicción que emitió la matrícula
    extraLicenses: jsonb('extra_licenses').$type<Record<string, string>>(), // matrículas adicionales (ej: { MN: '123', RE: '45' })
    city: text('city').notNull(),
    province: text('province').notNull(),
    bio: text('bio'),

    // Cómo y a quién atiende (todo se muestra en el perfil y alimenta los filtros del buscador)
    specialties: jsonb('specialties').$type<string[]>().notNull().default(sql`'[]'::jsonb`), // varias por profesional
    corrientes: jsonb('corrientes').$type<string[]>().notNull().default(sql`'[]'::jsonb`), // orientaciones (Psicología)
    ageGroups: jsonb('age_groups').$type<string[]>().notNull().default(sql`'[]'::jsonb`), // ninos | adolescentes | adultos
    modalidad: text('modalidad').notNull().default('PRESENCIAL'), // PRESENCIAL | ONLINE | AMBAS
    obrasSociales: jsonb('obras_sociales').$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    // Paso 2 del onboarding
    photoUrl: text('photo_url'), // pública (ya optimizada). Opcional: sin foto se muestra el logo
    titleDocPath: text('title_doc_path'), // PRIVADA: ruta en storage/private, solo la ve el panel /admin

    // Verificación manual
    verificationStatus: verificationStatus('verification_status').notNull().default('PENDING'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    rejectionNote: text('rejection_note'),

    // Validación automática de la matrícula (REFEPS). El DNI se usa para consultar pero NO se guarda.
    matriculaStatus: matriculaStatus('matricula_status').notNull().default('NOT_CHECKED'),
    matriculaCheckedAt: timestamp('matricula_checked_at', { withTimezone: true }),
    matriculaDetail: text('matricula_detail'), // motivo legible (ej: "El nombre no coincide con el titular")
    matriculaSource: text('matricula_source'), // 'REFEPS' | 'MOCK'
    refepsCode: text('refeps_code'), // código federal del profesional (dato público del registro)
    verificationMethod: text('verification_method'), // 'AUTO_REFEPS' | 'MANUAL'

    // Mes de prueba: se concede una sola vez por profesional
    trialUsedAt: timestamp('trial_used_at', { withTimezone: true }),

    // Estado de publicación (lo mueve el webhook de Mercado Pago)
    status: professionalStatus('status').notNull().default('PENDING_PAYMENT'),
    inactiveReason: inactiveReason('inactive_reason'),
    isFeatured: boolean('is_featured').notNull().default(false),

    // Link para regularizar el pago (se envía por mail cuando falla el débito)
    regularizeToken: text('regularize_token').unique(),
    regularizeTokenExpiresAt: timestamp('regularize_token_expires_at', { withTimezone: true }),

    // Consentimientos (datos de salud: se guarda prueba de aceptación)
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }).notNull(),
    termsVersion: text('terms_version').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }), // borrado lógico
  },
  (t) => [
    // Evita que la misma matrícula se registre dos veces
    uniqueIndex('professionals_license_uq').on(t.profession, t.licenseType, t.licenseProvince, t.licenseNumber),
    index('professionals_public_idx').on(t.status, t.verificationStatus, t.deletedAt),
    index('professionals_search_idx').on(t.profession, t.city),
  ],
);

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  professionalId: text('professional_id')
    .notNull()
    .unique()
    .references(() => professionals.id, { onDelete: 'restrict' }),

  /** ID de la suscripción (preapproval) en Mercado Pago. Se actualiza si el profesional vuelve a suscribirse. */
  mpPreapprovalId: text('mp_preapproval_id').notNull().unique(),
  status: subscriptionStatus('status').notNull().default('PENDING'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('ARS'),
  checkoutUrl: text('checkout_url'), // init_point del checkout

  /** ¿Esta suscripción incluye el mes gratis? Se decide al crear el checkout. */
  hasTrial: boolean('has_trial').notNull().default(false),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

  nextPaymentDate: timestamp('next_payment_date', { withTimezone: true }),
  lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Auditoría de cada notificación recibida (útil para depurar y reconciliar cobros). */
export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    topic: text('topic').notNull(),
    resourceId: text('resource_id').notNull(),
    requestId: text('request_id'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    outcome: text('outcome'),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('webhook_logs_topic_idx').on(t.topic, t.resourceId), index('webhook_logs_received_idx').on(t.receivedAt)],
);

/** Mensajes del formulario de Contacto. */
export const contactMessages = pgTable('contact_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  topic: text('topic').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Professional = typeof professionals.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
