export interface Currency {
    token: string,
    balance: number
}

export interface IssuerAccount {
    issuer: string,
    tokens: Currency[]
}

export interface IssuerData {
    amount: number,
    trustlines: number,
    holders: number,
    offers: number,
    created?: string,
    self_assessment?: any
}
 
export interface IssuerVerification {
    resolvedBy: string,
    account: string,
    verified: boolean,
    kyc?: boolean,
    domain?: string,
    username?: string,
    twitter?: string
}

export interface URIToken {
    URITokenID: string,
    Owner: string,
    Issuer: string,
    URI: string,
    Digest?: string,
    Amount?: any,
    Destination?: string,
    Flags?: number
}

export interface UriTokenApiReturnObject {
    info: {
        ledger_index: number,
        ledger_hash: string,
        ledger_close: string,
        ledger_close_ms: number
    },
    data: {
        [key: string]: any
    }
}

export interface MarketPlaceStats {
    mp_account: string,
    buy_offers:number,
    sell_offers: number,
    nfts_for_sale: number,
    floor: FloorPriceProperty[]
}

export interface FloorPriceProperty {
    issuer: string,
    currency: string,
    amount: number
}

export interface SupplyInfoType {
    ledger: number,
    closeTimeHuman: string,
    accounts: number,
    xahExisting: number,
    xah: {
        xahTotalSupply: number,
        xahTotalBalance: number,
        xahTotalReserved: number,
        xahTotalTransientReserves: number
    },
    ledger_data: string
}

