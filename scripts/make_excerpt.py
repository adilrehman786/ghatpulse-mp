"""Official rows manually transcribed from linked raw CSV line numbers; ONLY an excerpt, never inflate totals."""
import csv
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'public/data/verified_excerpt.csv'
heads='year festival site water_body phase parameter value unit_assumed flag value_as_printed parameter_as_printed site_as_printed site_match_confidence source_page'.split()
# 2025 Ganesh, same ordering as source CSV; entries contain exact original numeric and printed values.
sites={
 'Khatlapura ghat':('Lower Lake','Khatlapura murti visarjan ghat at lower lake, Bhopal','high','28',
  {'pH':['7.34','8.0','7.76'],'Dissolved oxygen':['7.3','6.0','6.5'],'BOD':['4.4','5.4','5.2']},
  {'pH':['7.34','8','7.76'],'Dissolved oxygen':['7.3','6','6.5'],'BOD':['4.4','5.4','5.2']}),
 'Bairagarh (Sant Hirdaram) kund':('Upper Lake','Sant Hirdaram Visarjankund, Bairagarh, Bhopal','high','28',
  {'pH':[None,'7.36',None],'Dissolved oxygen':[None,'0.0',None],'BOD':[None,'8.0',None]},
  {'pH':['*','7.36','**'],'Dissolved oxygen':['','0',''],'BOD':['','8','']}),
 'Prempura ghat':('Upper Lake','Prempura Visarjanghat, Bhopal','high','28',
  {'pH':['7.41','8.01','7.92'],'Dissolved oxygen':['6.5','5.6','6.0'],'BOD':['4.8','4.8','3.0']},
  {'pH':['7.41','8.01','7.92'],'Dissolved oxygen':['6.5','5.6','6'],'BOD':['4.8','4.8','3']}),
 'Rani Kamlapati ghat / Kamla Park kund':('Lower Lake (as printed in Durga tables)','Rani kamlapati,kamla park,murti visarjan kund, Bhopal','medium','29',
  {'pH':['7.46','7.7','7.62'],'Dissolved oxygen':['6.9','6.9','6.2'],'BOD':['3.8','6.9','4.8']},
  {'pH':['7.46','7.7','7.62'],'Dissolved oxygen':['6.9','6.9','6.2'],'BOD':['3.8','6.9','4.8']}),
 'Hathaikheda dam / kund':('Hathaikheda dam','Hathaikheda visarjan kund, Bhopal','high','29',
  {'pH':['8.23','8.71','8.44'],'Dissolved oxygen':['5.6','7.0','6.4'],'BOD':['5.2','10.0','5.2']},
  {'pH':['8.23','8.71','8.44'],'Dissolved oxygen':['5.6','7','6.4'],'BOD':['5.2','10','5.2']}),
 'Malikhedi kund':('Kund','Maalikhedi visarjan kund, Bhopal','high','29',
  {'pH':[None,'7.53',None],'Dissolved oxygen':[None,'0.6',None],'BOD':[None,'5.8',None]},
  {'pH':['*','7.53','**'],'Dissolved oxygen':['','0.6',''],'BOD':['','5.8','']}),
 'Shahpura lake ghat':('Shahpura Lake','Murti visarjan ghat at Shahpura ghat, Bhopal','high','30',
  {'pH':['7.7','7.82','7.84'],'Dissolved oxygen':['7.0','6.0','6.5'],'BOD':['4.2','5.0','4.8']},
  {'pH':['7.7','7.82','7.84'],'Dissolved oxygen':['7','6','6.5'],'BOD':['4.2','5','4.8']}),
}
rows=[]
def add(year,festival,site,body,phase,param,value,printed,name,confidence,page,flag=''):
 rows.append(dict(year=year,festival=festival,site=site,water_body=body,phase=phase,parameter=param,value=value or '',unit_assumed='' if param=='pH' else 'mg/l',flag=flag,value_as_printed=printed,parameter_as_printed='D.Oxygen' if param=='Dissolved oxygen' else param,site_as_printed=name,site_match_confidence=confidence,source_page=page))
for site,(body,name,conf,page,values,printed) in sites.items():
 for param,vals in values.items():
  for phase,val,printval in zip(['pre','during','after'],vals,printed[param]):
   flag=('*' if phase=='pre' else '**') if val is None and param=='pH' else ('not sampled' if val is None else '')
   add('2025','Ganesh',site,body,phase,param,val,printval,name,conf,page,flag)
# Truthful 2023 additions from source line 52–57 (zero reading included).
site='Bairagarh (Sant Hirdaram) kund';body='Upper Lake';name='Sant Hirdaram Visarjankund, Bairagarh, Bhopal'
for param,values in [('Dissolved oxygen',[('5.6','5.6'),('4.5','4.5'),('0.0','0')]),('BOD',[('3.8','3.8'),('4.2','4.2'),('10.0','10')])]:
 for phase,(value,printed) in zip(['pre','during','after'],values):add('2023','Ganesh',site,body,phase,param,value,printed,name,'high','26')
# Genuine BDL & not-sampled source observations 2023 Ganesh, Khatlapura page 26.
site='Khatlapura ghat';name='Khatlapura Visarjanghat, Bhopal'
for phase,flag,p in [('pre','BDL','BDL'),('during','not sampled','_'),('after','BDL','BDL')]:
 rows.append(dict(year='2023',festival='Ganesh',site=site,water_body='Lower Lake',phase=phase,parameter='Chromium',value='',unit_assumed='mg/l',flag=flag,value_as_printed=p,parameter_as_printed='Chromium',site_as_printed=name,site_match_confidence='high',source_page='26'))
with path.open('w',newline='',encoding='utf8') as f:
 w=csv.DictWriter(f,fieldnames=heads);w.writeheader();w.writerows(rows)
print(len(rows),'genuine excerpt records generated; these are not the full 1,524 observations')
