import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openSealed } from "./seal.mjs";
import { sealedName } from "./sealed-name.mjs";

export function readPortfolioData(passphrase, root) {
  if (!passphrase) {
    throw new Error("MISC_PASSPHRASE is missing");
  }
  const directory = join(root, "data");
  const portfolio = openJson(join(directory, sealedName(passphrase, "portfolio")), passphrase);
  const symbols = [
    ...portfolio.indexes.map((index) => index.market.symbol),
    ...portfolio.fx.map((rate) => rate.symbol),
  ];
  const series = {};
  for (const symbol of symbols) {
    const history = openJson(join(directory, sealedName(passphrase, symbol)), passphrase);
    if (history.symbol !== symbol || !history.points?.length) {
      throw new Error(`Sealed series does not match ${symbol}`);
    }
    series[symbol] = history.points;
  }
  return { portfolio, series };
}

function openJson(path, passphrase) {
  try {
    return JSON.parse(openSealed(readFileSync(path), passphrase).toString("utf8"));
  } catch {
    throw new Error(`${path} could not be opened`);
  }
}
