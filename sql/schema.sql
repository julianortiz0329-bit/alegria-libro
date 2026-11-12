-- Esquema oficial de Alegría Pet Home (sincronizado con producción en Supabase)
CREATE SCHEMA IF NOT EXISTS alegria;

-- 1. Tabla de socios
CREATE TABLE IF NOT EXISTS alegria.socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  clave_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE alegria.socios ENABLE ROW LEVEL SECURITY;

-- 2. Tabla de registros contables
CREATE TABLE IF NOT EXISTS alegria.registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  monto numeric(14,2) NOT NULL,
  descripcion text NOT NULL,
  categoria text,
  fecha date NOT NULL,
  creado_por uuid REFERENCES alegria.socios(id),
  actualizado_por uuid REFERENCES alegria.socios(id),
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  actualizado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE alegria.registros ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS alegria_registros_actualizado_por_idx
  ON alegria.registros (actualizado_por);

-- 3. Tabla de adjuntos
CREATE TABLE IF NOT EXISTS alegria.adjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid REFERENCES alegria.registros(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  url text NOT NULL,
  tamano bigint,
  creado_por uuid REFERENCES alegria.socios(id),
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE alegria.adjuntos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS alegria_adjuntos_creado_por_idx
  ON alegria.adjuntos (creado_por);

-- 4. Protección contra fuerza bruta (Rate Limiting)
CREATE TABLE IF NOT EXISTS alegria.intentos_fallidos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE alegria.intentos_fallidos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS alegria_intentos_fallidos_ocurrido_en_idx
  ON alegria.intentos_fallidos (ocurrido_en);

-- 5. Función de autenticación con rate limiting
CREATE OR REPLACE FUNCTION alegria.socio_de(p_clave text)
 RETURNS alegria.socios
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s alegria.socios;
  v_fallos int;
begin
  delete from alegria.intentos_fallidos
   where ocurrido_en < clock_timestamp() - interval '1 hour';

  select count(*) into v_fallos
    from alegria.intentos_fallidos
   where ocurrido_en > clock_timestamp() - interval '15 minutes';

  if v_fallos >= 15 then
    raise exception 'Demasiados intentos fallidos. Espera 15 minutos.' using errcode = '28000';
  end if;

  if p_clave is null or length(p_clave) < 16 then
    insert into alegria.intentos_fallidos default values;
    raise exception 'Clave no válida' using errcode = '28000';
  end if;

  select * into s
    from alegria.socios
   where clave_hash = encode(extensions.digest(p_clave, 'sha256'), 'hex')
     and activo;

  if not found then
    insert into alegria.intentos_fallidos default values;
    raise exception 'Clave no válida' using errcode = '28000';
  end if;

  return s;
end $function$;
