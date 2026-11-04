-- Catálogo: la página de la lista de precios que faltaba (de "Corona ZR UEC/Ang" a
-- "Núcleo disilicato/zirconio"). Ver docs/fuentes/transcripcion-precios.md y
-- docs/fuentes/precios-3.jpeg. Columna "Marzo 26", en miles de pesos.
--
-- Es idempotente: no repite un trabajo que ya exista con el mismo código o título, ni le
-- pone precio a un trabajo que ya tenga alguno.
--
-- Los renglones con guion quedan sin precio, como en el resto del catálogo. "Muñón epoxi"
-- está tachado en el papel y no se carga.

insert into public.trabajos (codigo, titulo, descripcion)
select v.codigo, v.titulo, v.descripcion
  from (values
    ('CZRU',   'Corona ZR UEC / Ang',                        null),
    ('CUBT',   'Cubeta individual transf. p/ implantes',     null),
    ('CUBI',   'Cubetillas para impresión o desgaste',       null),
    ('DIFF',   'Diferencia error facturación',               'El importe se escribe en cada orden'),
    ('DIFP',   'Diferencia piezas',                          'El importe se escribe en cada orden'),
    ('DCAD',   'Diseño CAD p/ pieza',                        null),
    ('DCRCO',  'Diseño digital CrCo',                        null),
    ('EMB',    'Emergente p/ base de barra',                 null),
    ('EDD',    'Encerado diagnóstico digital',               null),
    ('EDDC',   'Encerado diagnóstico digital completo',      null),
    ('EDM',    'Encerado diagnóstico manual',                null),
    ('ENCA',   'Encía artificial',                           null),
    ('ENCC',   'Encía cerámica',                             null),
    ('ENF',    'Enfilado diagnóstico p/ pieza',              null),
    ('ESC',    'Escaneo de modelos por maxilar',             null),
    ('ESQ',    'Esqueleto de Cr-Co s/ atache',               null),
    ('GLA',    'Glaceado',                                   null),
    ('GUIA',   'Guía quirúrgica (impresa)',                  null),
    ('INCP',   'Incrustación a perno',                       null),
    ('INCPP',  'Incrustación a perno pte',                   null),
    ('INCCER', 'Incrustación Ceramage',                      null),
    ('INCD',   'Incrustación disilicato',                    null),
    ('INCM',   'Incrustación metálica',                      null),
    ('INCZ',   'Incrustación zirconio',                      null),
    ('INFZ',   'Infiltrado Zr opaco / encía',                null),
    ('TIB',    'Interface Ti-Base c/ tornillo',              null),
    ('LLD',    'Llave de comprobación c/ Duralay',           null),
    ('LLS',    'Llave de silicona',                          null),
    ('MARA',   'Maryland 1 pieza acrílico',                  null),
    ('MARC',   'Maryland 1 pieza cerámica',                  null),
    ('MARZ',   'Maryland 1 pieza Zr',                        null),
    ('MODE',   'Modelo de estudio c/u',                      null),
    ('MOD',    'Modelo impreso',                             null),
    ('MONT',   'Montaje en articulador',                     null),
    ('NUC',    'Núcleo disilicato / zirconio',               null)
  ) as v (codigo, titulo, descripcion)
 where not exists (
   select 1 from public.trabajos t
    where t.codigo = v.codigo or lower(t.titulo) = lower(v.titulo)
 );

insert into public.precios_trabajo (trabajo_id, precio, vigente_desde)
select t.id, p.precio, date '2026-03-01'
  from public.trabajos t
  join (values
    ('CZRU',   180000.00),
    ('CUBT',    30000.00),
    ('CUBI',    15000.00),
    -- Las diferencias no tienen precio fijo: arrancan en cero y se escribe el importe
    -- en la orden con "Precio final", como el envío.
    ('DIFF',        0.00),
    ('DIFP',        0.00),
    ('DCAD',    12000.00),
    ('EMB',    100000.00),
    ('EDD',     18000.00),
    ('EDDC',   140000.00),
    ('EDM',     30000.00),
    ('ENCA',     7000.00),
    ('ENCC',    35000.00),
    ('ENF',     10000.00),
    ('ESC',     15000.00),
    ('ESQ',    160000.00),
    -- TODO: en el papel se lee "138" pero la columna anterior dice 45: confirmar.
    ('GUIA',   138000.00),
    ('INCP',   140000.00),
    ('INCPP',  150000.00),
    ('INCCER', 150000.00),
    ('INCD',   160000.00),
    ('INCM',   120000.00),
    ('INCZ',   145000.00),
    ('INFZ',    30000.00),
    ('LLD',     30000.00),
    ('MARA',   135000.00),
    ('MARC',   300000.00),
    -- Anotado a mano al lado de "Maryland 1 pza cerámica": "/ Zr 275 $".
    ('MARZ',   275000.00),
    ('MODE',    25000.00),
    ('MOD',     25000.00)
  ) as p (codigo, precio) on p.codigo = t.codigo
 where not exists (select 1 from public.precios_trabajo x where x.trabajo_id = t.id);
