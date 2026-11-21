import io, contextlib, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
with contextlib.redirect_stdout(io.StringIO()):
    import exp30 as E
import numpy as np, pandas as pd
def racha_weekly(look, every=5, kind='ret'):
    out = pd.DataFrame(0.0, index=E.C.index, columns=E.U)
    seg_daily = {n: {g: E.DM[n][:, E.COLS[g]].mean(1) for g in E.SEG} for n in E.BASE}
    choice = {}
    for ti, d in enumerate(E.D):
        if ti < look: continue
        if (ti - look) % every == 0:
            for g in E.SEG:
                sc = {n: (np.prod(1 + seg_daily[n][g][ti-look+1:ti+1]) - 1) if kind == 'ret' else
                      ((10 + (seg_daily[n][g][ti-look+1:ti+1] > 0).sum()) / (20 + (seg_daily[n][g][ti-look+1:ti+1] != 0).sum())) for n in E.BASE}
                choice[g] = max(sc, key=sc.get)
        for g, assets in E.SEG.items():
            out.loc[d, assets] = E.INV[choice[g]][1].loc[d, assets]
    return out
for name, pos in [('semanal 60d', racha_weekly(60)), ('mensual 60d', racha_weekly(60, 21)), ('mensual perdón', racha_weekly(60, 21, 'beta'))]:
    dm = E.daily_matrix(pos); tot = E.equity_from(dm)[-1]-1
    print(name, round(tot*100,1), 'pct monos', round((E.mk_all < tot).mean()*100,1))
# racha diaria sin costes
P = E.INV['Racha 60 días'][1]
Pw = P.shift(1).reindex(E.D).fillna(0).values * ~np.isnan(E.C.reindex(E.D).values)
print('racha 60d diaria SIN costes', round(((1 + Pw * E.Rw).cumprod(0).mean(1)[-1]-1)*100,1))
# media de familias como cartera combinada (meta-modelo simple, igual peso entre las 28 tesis)
thesis=[n for n in E.INV if E.INV[n][0] not in ('Control','Racha')]
avg = sum(E.INV[n][1] for n in thesis)/len(thesis)
dm = E.daily_matrix(avg); tot=E.equity_from(dm)[-1]-1
print('meta-modelo igual peso (posición media de', len(thesis), 'tesis)', round(tot*100,1), 'pct', round((E.mk_all < tot).mean()*100,1))
