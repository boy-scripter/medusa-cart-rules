import { Module } from "@medusajs/framework/utils"
import CartRulesModuleService from "./service"

export const CART_RULES_MODULE = "cartRules"

export default Module(CART_RULES_MODULE, { service: CartRulesModuleService })
