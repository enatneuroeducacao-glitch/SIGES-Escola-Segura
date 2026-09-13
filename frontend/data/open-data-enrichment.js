// SIGES — enriquecimento seguro por dados abertos
// Regra: somente preencher campos ausentes quando houver evidência específica.
// Nunca sobrescrever valores existentes e nunca inferir um atributo territorial.

export function enrichMissingReportData(base = {}, openData = {}) {
  const result = { ...base };
  const evidence = {};

  const setIfMissing = (field, value, source) => {
    if ((result[field] === undefined || result[field] === null || result[field] === '' || result[field] === '—') && value !== undefined && value !== null && value !== '') {
      result[field] = value;
      evidence[field] = source;
    }
  };

  // Valores devem chegar aqui já vinculados ao ponto/corredor analisado.
  // Não usamos presença de camada como prova do atributo.
  setIfMissing('velocidade_kmh', openData.velocidade_kmh, openData.velocidade_source);
  setIfMissing('vdm', openData.vdm, openData.vdm_source);
  setIfMissing('sinistros_3_anos', openData.sinistros_3_anos, openData.sinistros_source);
  setIfMissing('travessias', openData.travessias, openData.travessias_source);
  setIfMissing('calcada', openData.calcada, openData.calcada_source);
  setIfMissing('sinalizacao', openData.sinalizacao, openData.sinalizacao_source);
  setIfMissing('iluminacao', openData.iluminacao, openData.iluminacao_source);
  setIfMissing('embarque_desembarque', openData.embarque_desembarque, openData.embarque_source);
  setIfMissing('ciclistas', openData.ciclistas, openData.ciclistas_source);

  return { data: result, evidence };
}
