/**
 * 技能数值表达式。只认 ATTR_NAMES 与 ExprVar/ExprFn，不要 eval。
 * 例：floor(skillLevel / 25) + 1、maxHp * 0.1。
 */
import { ATTR_NAMES } from "./constants.ts"
import { ExprFn, ExprVar } from "./enums.ts"
import type { Expr, ExprEnv, Unit } from "./types.ts"

export function evalExpr(expr: Expr | undefined, env: ExprEnv): number {
  if (expr === undefined) return 0
  if (typeof expr === "number") return expr
  const tokens = tokenize(expr)
  const parser = new Parser(tokens, env)
  const value = parser.parseExpr()
  parser.expectEnd()
  if (!Number.isFinite(value)) return 0
  return value
}

export function skillLevelOf(unit: Unit, skillId: string): number {
  return unit.skillLevels[skillId] ?? unit.level
}

function bindUnit(unit: Unit): Record<string, number> {
  const out: Record<string, number> = { level: unit.level }
  for (const key of ATTR_NAMES) out[key] = unit.attrs[key]
  return out
}

type Tok =
  | { kind: "num"; value: number }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string }

function tokenize(input: string): Tok[] {
  const src = input.replace(/\s+/g, "")
  const tokens: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c >= "0" && c <= "9") {
      let j = i
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++
      tokens.push({ kind: "num", value: Number(src.slice(i, j)) })
      i = j
      continue
    }
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      let j = i
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++
      tokens.push({ kind: "id", value: src.slice(i, j) })
      i = j
      continue
    }
    if (src.startsWith(">=", i) || src.startsWith("<=", i) || src.startsWith("==", i)) {
      tokens.push({ kind: "op", value: src.slice(i, i + 2) })
      i += 2
      continue
    }
    if ("+-*/(),><".includes(c)) {
      tokens.push({ kind: "op", value: c })
      i++
      continue
    }
    throw new Error(`bad expr token "${c}" in "${input}"`)
  }
  return tokens
}

class Parser {
  private i = 0
  constructor(
    private readonly tokens: Tok[],
    private readonly env: ExprEnv,
  ) {}

  parseExpr(): number {
    return this.parseCompare()
  }

  private parseCompare(): number {
    const left = this.parseAdd()
    const op = this.op()
    if (op === ">" || op === "<" || op === ">=" || op === "<=" || op === "==") {
      this.bumpOp()
      const right = this.parseAdd()
      if (op === ">") return left > right ? 1 : 0
      if (op === "<") return left < right ? 1 : 0
      if (op === ">=") return left >= right ? 1 : 0
      if (op === "<=") return left <= right ? 1 : 0
      return left === right ? 1 : 0
    }
    return left
  }

  expectEnd(): void {
    if (this.i < this.tokens.length) {
      throw new Error("unexpected trailing tokens in expr")
    }
  }

  private parseAdd(): number {
    let left = this.parseMul()
    while (this.op() === "+" || this.op() === "-") {
      const op = this.bumpOp()
      const right = this.parseMul()
      left = op === "+" ? left + right : left - right
    }
    return left
  }

  private parseMul(): number {
    let left = this.parseUnary()
    while (this.op() === "*" || this.op() === "/") {
      const op = this.bumpOp()
      const right = this.parseUnary()
      left = op === "*" ? left * right : right === 0 ? 0 : left / right
    }
    return left
  }

  private parseUnary(): number {
    if (this.op() === "-") {
      this.bumpOp()
      return -this.parseUnary()
    }
    if (this.op() === "+") {
      this.bumpOp()
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): number {
    const tok = this.peek()
    if (!tok) throw new Error("unexpected end of expr")
    if (tok.kind === "num") {
      this.i++
      return tok.value
    }
    if (tok.kind === "id") {
      this.i++
      if (this.op() === "(") return this.callFn(tok.value)
      return this.lookup(tok.value)
    }
    if (tok.kind === "op" && tok.value === "(") {
      this.i++
      const inner = this.parseExpr()
      if (this.op() !== ")") throw new Error("missing )")
      this.i++
      return inner
    }
    throw new Error(`unexpected token ${JSON.stringify(tok)}`)
  }

  private callFn(name: string): number {
    if (this.op() !== "(") throw new Error(`expected ( after ${name}`)
    this.i++
    const args: number[] = []
    if (this.op() !== ")") {
      args.push(this.parseExpr())
      while (this.op() === ",") {
        this.i++
        args.push(this.parseExpr())
      }
    }
    if (this.op() !== ")") throw new Error(`missing ) after ${name}`)
    this.i++
    if (name === ExprFn.Floor) return Math.floor(args[0] ?? 0)
    if (name === ExprFn.Min) return Math.min(...args)
    if (name === ExprFn.Max) return Math.max(...args)
    if (name === ExprFn.If) return (args[0] ?? 0) !== 0 ? (args[1] ?? 0) : (args[2] ?? 0)
    throw new Error(`unknown function ${name}`)
  }

  private lookup(name: string): number {
    if (name === ExprVar.SkillLevel) return this.env.skillLevel
    if (name === ExprVar.Targets) return this.env.targets
    if (name === ExprVar.Damage) return this.env.damage ?? 0
    if (name === ExprVar.HpDamage) return this.env.hpDamage ?? 0
    if (name === ExprVar.Level) return this.env.source.level
    const dotted = name.split(".")
    if (dotted.length === 2) {
      const root = dotted[0] === ExprVar.Source ? this.env.source : dotted[0] === ExprVar.Target ? this.env.target : undefined
      if (!root) return 0
      const bound = bindUnit(root)
      return bound[dotted[1]] ?? 0
    }
    const bound = bindUnit(this.env.source)
    return bound[name] ?? 0
  }

  private peek(): Tok | undefined {
    return this.tokens[this.i]
  }

  private op(): string | undefined {
    const tok = this.peek()
    return tok?.kind === "op" ? tok.value : undefined
  }

  private bumpOp(): string {
    const tok = this.peek()
    if (!tok || tok.kind !== "op") throw new Error("expected operator")
    this.i++
    return tok.value
  }
}
