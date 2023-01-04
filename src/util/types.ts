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

export interface NFT {
    NFTokenID: string,
    TransferFee: number,
    Issuer: string,
    Owner: string,
    Taxon: number,
    Sequence: number,
    URI: string,
    Flags?: number
}

export interface NFTokenOffer {
    Amount: any,
    Flags: number,
    NFTokenID: string,
    Owner: string,
    OfferID: string,
    Destination: string,
    Expiration: number
}

export interface NFTokenOfferMapEntry {
    buy: Map<string,NFTokenOffer>,
    sell: Map<string,NFTokenOffer>
}

export interface NFTokenOfferReturnObject {
    NFTokenID: string,
    buy: NFTokenOffer[],
    sell: NFTokenOffer[]
}

export interface NftApiReturnObject {
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

export interface NftCollectionInfo {
    issuer:string,
    taxon: number,
    nfts: number,
    unique_owners: number,
    buy_offers:number,
    sell_offers: number,
    nfts_for_sale: number,
    floor: FloorPriceProperty[],
    open_market: {
        buy_offers:number,
        sell_offers: number,
        nfts_for_sale: number,
        floor: FloorPriceProperty[]
    },
    market_places: MarketPlaceStats[]
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
