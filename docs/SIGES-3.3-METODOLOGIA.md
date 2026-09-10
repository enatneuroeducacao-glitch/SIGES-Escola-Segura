# SIGES 3.3 — Metodologia de Mensuração Territorial

## Objetivo

Transformar a matriz HSI-DOTH-P Escolar em uma base territorial mensurável, rastreável e adequada para apresentação técnica ao Município de Joinville.

## Unidade de análise

A unidade primária é a unidade escolar da matriz SIGES. A correspondência espacial prioritária é feita contra a camada oficial de unidades escolares da Secretaria de Educação de Joinville (SED), em SIRGAS 2000 / UTM 22S, EPSG:31982.

## Janela territorial

O SIGES 3.3 usa, para a primeira camada de triagem, um raio de 500 metros a partir do ponto oficial da unidade escolar. Esse raio é um parâmetro analítico de triagem e não representa uma área legal de influência.

## Indicadores mensurados

- correspondência da unidade com a camada oficial SED;
- acidentes de trânsito **com vítimas** em 500 m, separados por 2023, 2024 e 2025;
- número de vítimas registradas nesses acidentes;
- pontos de ônibus georreferenciados em 500 m;
- registros de survey/vistoria viária próximos à escola;
- velocidade observada em registros de survey próximos, quando existente;
- observações de calçada, iluminação e segurança viária, quando existentes nos registros públicos de survey.

## Fontes públicas oficiais

1. Prefeitura de Joinville / SIMGeo — sistema municipal de informações georreferenciadas.
2. Secretaria de Educação / SED — camada oficial de unidades escolares.
3. Base municipal de acidentes de trânsito com vítimas, publicada no ambiente geográfico municipal.
4. Pontos de ônibus georreferenciados do Município.
5. Camada pública de survey de segurança viária, quando disponível e compatível com a análise.
6. DETRANS — estudos técnicos de equipamentos de fiscalização eletrônica.
7. CBVJ / bases públicas utilizadas na série de sinistros por corredor.

## Regras de integridade

- Não preencher campo ausente com valor estimado.
- Diferenciar "não localizado" de zero.
- Zero de acidente significa zero registro encontrado na camada consultada para o período e raio, não ausência absoluta de risco.
- Acidentes da camada municipal representam acidentes com vítimas; não devem ser apresentados como total de todos os sinistros sem essa qualificação.
- Indicadores territoriais não substituem vistoria de engenharia, contagem de tráfego, estudo de velocidade ou decisão administrativa.
- Todo indicador derivado deve manter sua fonte, período e parâmetro espacial.

## Classificação de evidência

**Fonte oficial direta:** dado publicado pelo Município ou órgão público responsável.

**Dado geoprocessado:** indicador calculado pelo SIGES a partir de geometria oficial e parâmetro espacial explícito.

**Dado de campo:** resultado de vistoria/avaliação realizada no local.

**Dado histórico:** informação mantida da matriz HSI-DOTH-P Escolar 3.2 anterior ao enriquecimento geoespacial.

## Apresentação à Prefeitura

O SIGES deve apresentar separadamente:

- o que é observado;
- o que é calculado;
- o que é informado por fonte pública;
- o que ainda depende de campo;
- a data de atualização;
- a fonte de cada indicador.

Isso evita transformar ausência de informação em falsa evidência de segurança.
