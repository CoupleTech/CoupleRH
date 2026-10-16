import { supabase } from '../../lib/supabase';

export interface WorkplaceGeofenceConfig {
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  enforce_geofence: boolean;
}

export type GeofenceStatus =
  | 'INSIDE'
  | 'OUTSIDE'
  | 'TELEWORK'
  | 'AUDIT_ONLY'
  | 'NO_GPS'
  | 'NO_CONFIG';

export interface GeofenceValidationResult {
  isAllowed: boolean;
  status: GeofenceStatus;
  distanceMeters: number | null;
  allowedRadiusMeters: number;
  message: string;
}

/**
 * Calcula a distância geodésica em metros entre duas coordenadas (Fórmula de Haversine)
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371000; // Raio médio da Terra em metros
  const toRad = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Valida se o colaborador está dentro do perímetro autorizado para marcação de ponto
 */
export function validateGeofence(params: {
  userLat: number | null;
  userLon: number | null;
  userAccuracy?: number | null;
  workplace: WorkplaceGeofenceConfig | null;
  isTelework?: boolean;
}): GeofenceValidationResult {
  const { userLat, userLon, workplace, isTelework = false } = params;

  // 1. Regime de Teletrabalho / Home Office dispensado de cerca física
  if (isTelework) {
    return {
      isAllowed: true,
      status: 'TELEWORK',
      distanceMeters: null,
      allowedRadiusMeters: workplace?.radius_meters || 0,
      message: '🏠 Regime de Teletrabalho / Home Office: Registro autorizado em qualquer localização.'
    };
  }

  // 2. Local de trabalho sem coordenadas cadastradas
  if (!workplace || workplace.latitude === null || workplace.longitude === null) {
    return {
      isAllowed: true,
      status: 'NO_CONFIG',
      distanceMeters: null,
      allowedRadiusMeters: workplace?.radius_meters || 0,
      message: 'Local de trabalho sem perímetro GPS delimitado. Registro presencial autorizado.'
    };
  }

  const radius = workplace.radius_meters || 50;

  // 3. Ausência de GPS quando obrigatório
  if (userLat === null || userLon === null) {
    if (workplace.enforce_geofence) {
      return {
        isAllowed: false,
        status: 'NO_GPS',
        distanceMeters: null,
        allowedRadiusMeters: radius,
        message: '⛔ GPS não detectado. A empresa exige geolocalização ativa para confirmar a presença física.'
      };
    }

    return {
      isAllowed: true,
      status: 'AUDIT_ONLY',
      distanceMeters: null,
      allowedRadiusMeters: radius,
      message: '⚠️ Ponto sem GPS registrado para posterior auditoria.'
    };
  }

  // 4. Cálculo da distância geodésica em metros
  const distance = calculateHaversineDistanceMeters(
    workplace.latitude,
    workplace.longitude,
    userLat,
    userLon
  );

  const isInside = distance <= radius;

  // 5. Cerca restritiva obrigatória (enforce_geofence = true)
  if (workplace.enforce_geofence) {
    if (isInside) {
      return {
        isAllowed: true,
        status: 'INSIDE',
        distanceMeters: distance,
        allowedRadiusMeters: radius,
        message: `📍 Você está a ${distance}m de ${workplace.name} — Localização autorizada (raio máx: ${radius}m).`
      };
    }

    return {
      isAllowed: false,
      status: 'OUTSIDE',
      distanceMeters: distance,
      allowedRadiusMeters: radius,
      message: `⛔ Fora do perímetro autorizado: você está a ${distance}m de ${workplace.name} (limite máximo de tolerância: ${radius}m) — Bloqueado.`
    };
  }

  // 6. Cerca apenas para auditoria informativa (enforce_geofence = false)
  return {
    isAllowed: true,
    status: 'AUDIT_ONLY',
    distanceMeters: distance,
    allowedRadiusMeters: radius,
    message: isInside
      ? `📍 A ${distance}m da empresa (registro informativo de presença).`
      : `⚠️ A ${distance}m da empresa — fora do raio de ${radius}m (registro informativo de auditoria).`
  };
}

/**
 * Consulta as configurações de geofencing do contrato e do local de trabalho
 */
export async function fetchContractWorkplaceGeofence(
  contractId: string
): Promise<{
  workplace: WorkplaceGeofenceConfig | null;
  isTelework: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('employment_contracts')
      .select(`
        id,
        is_telework,
        workplaces (
          id,
          name,
          latitude,
          longitude,
          radius_meters,
          enforce_geofence
        )
      `)
      .eq('id', contractId)
      .single();

    if (error || !data) {
      return { workplace: null, isTelework: false };
    }

    const wp = (data as any).workplaces;
    const isTelework = Boolean(data.is_telework);

    if (!wp) {
      return { workplace: null, isTelework };
    }

    return {
      workplace: {
        name: wp.name || 'Sede da Empresa',
        latitude: wp.latitude !== null && wp.latitude !== undefined ? Number(wp.latitude) : null,
        longitude: wp.longitude !== null && wp.longitude !== undefined ? Number(wp.longitude) : null,
        radius_meters: wp.radius_meters ? Number(wp.radius_meters) : 50,
        enforce_geofence: Boolean(wp.enforce_geofence)
      },
      isTelework
    };
  } catch (err) {
    console.warn('Erro ao consultar geofence da lotação:', err);
    return { workplace: null, isTelework: false };
  }
}
