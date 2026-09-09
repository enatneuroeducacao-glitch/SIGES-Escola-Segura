import{describe,it,expect}from'vitest';
import{buildCorridorIntelligence}from'./radar-intelligence';

describe('Radar Territorial',()=>{
 it('agrega escolas por corredor sem converter ausência em zero',()=>{
  const rows=[
   {'Corredor normalizado':'monsenhor gercino','Prioridade':'P1','Nº estudos DETRANS corredor':4,'Acidentes corredor 2024':110,'IPE Territorial 3.2':90,'Confiabilidade territorial':90,'Evidência DETRANS (0-100)':100},
   {'Corredor normalizado':'monsenhor gercino','Prioridade':'P2','Nº estudos DETRANS corredor':4,'Acidentes corredor 2024':110,'IPE Territorial 3.2':80,'Confiabilidade territorial':90,'Evidência DETRANS (0-100)':100}
  ];
  const[g]=buildCorridorIntelligence(rows);
  expect(g.schools).toHaveLength(2);expect(g.p1).toBe(1);expect(g.p2).toBe(1);expect(g.detransStudies).toBe(4);expect(g.accident2024).toBe(110);expect(g.avgIpe).toBe(85);
 });
});
