CREATE TABLE "appointment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"appointment_pet_id" uuid,
	"type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"actor_user_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appointment_pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"appointment_id" uuid NOT NULL,
	"pet_id" uuid NOT NULL,
	"size" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'agendado' NOT NULL,
	"overbooked" boolean DEFAULT false NOT NULL,
	"checked_in_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_pets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"appointment_pet_id" uuid NOT NULL,
	"service_id" uuid,
	"name" text NOT NULL,
	"is_addon" boolean DEFAULT false NOT NULL,
	"price_cents" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"performed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"origin" text DEFAULT 'balcao' NOT NULL,
	"notes" text,
	"confirmed_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"document" text,
	"address_zip" text,
	"address_street" text,
	"address_number" text,
	"address_complement" text,
	"address_district" text,
	"address_city" text,
	"address_state" text,
	"origin" text,
	"notes" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"marketing_opt_in_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "member_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"percent" numeric(5, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_commissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"species" text DEFAULT 'cao' NOT NULL,
	"breed" text,
	"sex" text,
	"birth_date" date,
	"weight_kg" numeric(5, 2),
	"size" text NOT NULL,
	"coat" text,
	"neutered" boolean,
	"color" text,
	"temperament" text,
	"allergies" text,
	"restrictions" text,
	"notes" text,
	"bath_frequency_days" integer,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointment_pet_id_appointment_pets_id_fk" FOREIGN KEY ("appointment_pet_id") REFERENCES "public"."appointment_pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_pets" ADD CONSTRAINT "appointment_pets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_pets" ADD CONSTRAINT "appointment_pets_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_pets" ADD CONSTRAINT "appointment_pets_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_pet_id_appointment_pets_id_fk" FOREIGN KEY ("appointment_pet_id") REFERENCES "public"."appointment_pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_commissions" ADD CONSTRAINT "member_commissions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_commissions" ADD CONSTRAINT "member_commissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_events_appointment_idx" ON "appointment_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_pets_org_time_idx" ON "appointment_pets" USING btree ("organization_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "appointment_pets_appointment_idx" ON "appointment_pets" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_pets_pet_idx" ON "appointment_pets" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "appointment_services_pet_idx" ON "appointment_services" USING btree ("appointment_pet_id");--> statement-breakpoint
CREATE INDEX "appointments_org_starts_idx" ON "appointments" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_org_phone_idx" ON "customers" USING btree ("organization_id","phone") WHERE "customers"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customers_org_name_idx" ON "customers" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "member_commissions_org_user_idx" ON "member_commissions" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "pets_org_customer_idx" ON "pets" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "appointment_events" AS PERMISSIVE FOR ALL TO public USING (("appointment_events"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("appointment_events"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "appointment_pets" AS PERMISSIVE FOR ALL TO public USING (("appointment_pets"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("appointment_pets"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "appointment_services" AS PERMISSIVE FOR ALL TO public USING (("appointment_services"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("appointment_services"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "appointments" AS PERMISSIVE FOR ALL TO public USING (("appointments"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("appointments"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "customers" AS PERMISSIVE FOR ALL TO public USING (("customers"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("customers"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "member_commissions" AS PERMISSIVE FOR ALL TO public USING (("member_commissions"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("member_commissions"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "pets" AS PERMISSIVE FOR ALL TO public USING (("pets"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on')) WITH CHECK (("pets"."organization_id" = current_setting('app.org_id', true) OR current_setting('app.system', true) = 'on'));