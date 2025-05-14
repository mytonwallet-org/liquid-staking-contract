import { NetworkProvider, sleep } from "@ton-community/blueprint";
import { Address } from "ton-core";

export const ION_JETTON = Address.parse('EQACbwI38RnvclU5Wv6H9zDr8Ao_tq9NWilXxBmoE8yroZlF');
export const ION_POOL = Address.parse('EQAYI9vwZ3K5y9n_9-E8F_e3JzMzNNyEib0ddBlfAWOOsh_c');
export const ION_ADMIN = Address.parse('UQBUJEQkLZJZvCzOv7cG0WAp4616wR-BckVVs6eeu7r86jYI');
export const ION_LIBRARIAN = Address.parse('Ef9ymVquxBIMq3rheG_AzE4WQ7bUGQptF151_yJoEwVyJPZi');
export const ION_CONTROLLERS = [
  'Ef8A0mTJaj9uPCE2qcrohxG2N1bzJtIJIXvZd_QuNHF-H-LI', // 2
  'Ef-SxvAyj2GwHcU6jPxrd5iz_L06TzZfHkYWpqN17nrltAKQ', // 2
  'Ef-yiBUuqciHtvv0l7F4hDqoPOmY-q1VMVmL1_YPCgkAJrwq', // 1
  'Ef-8y1x76XKoimvKulMU13FWjx5FRFkTdAGWU9bpRrCuerQa', // 1
  // 'Ef-R7405k6jEMZkZGHpcz1AoUtphc-T4IGEFKSwqagLe3YF4', // old
  // 'Ef8Yu2l-qpYw63SDmwsg63AuO2oQ1D3GzvbMcoZnhY8GH1ot', // old
  // 'Ef-7GCkovbKpLhcjih84-zoF3wXvZD9ToksgviOK7u82H95d', // old old
  // 'Ef_RgAnLTqYpq4exvUAAI6nt6HRGDanpYN2LbeqqGiEAjk45', // old old
  'Ef_pgm6xhGvAnDvSzgvqqD9-n3jo7_x9Jz4ri6XHeZ62Y9zT',
  'Ef8OyUuwsWeKYxLM7CSEs30t1-DpjykL4NOb7DLqT8oTEsZF',
  'Ef8lF3vDAFzTkS8WpGDufggOGFlhgwBebVGPDoVcw_3Jd-Qm',
  'Ef96DcbM2UJVLkcRygSFTJaM-sp1JW9iFgJ7K5-Lxnq6WLWl',
  'Ef8vwcjnXVhejRSvRCJEHwhta4rVi7un5FWoeNf8S_tK0L4E',
  'Ef80ST_JMP_W5QKvXhN73-aKGfc_wUYPQU-64bWZNY07Otah',
  'Ef_neCAuIapcrDch48WHOWicI5GD8VOiyxZCFLK9LFuQzAng',
  'Ef-AubChyR1hUc_pBlPQBnWj6ltfsTLVG_xbHJQn5rQ9ysSA',
  'Ef86bLUbSU7XwtY9eqwXJ0CQY7W-w6DjTE96ObtBEFZe9lqO',
  'Ef-TzCsmBbbKgoHVlNI50Fhxg6ecFY_gYptWTNnuDvOaIRmo',
  'Ef-pxqsB4qK8RLcoi9Gh40_dF2wuP9GOsvf-2QtXHq4KU5t-',
  'Ef_uwA6HBrdc0ZtomKA70kWE5VWtFaKvrY7zRAA0IJr6PTr6',
  'Ef83WunCMNr2aBfy_ObH8fOkIpfNsmeXTLNN_-One-eC24ZU',
  'Ef8QWApaB6ZpCIAFOb20ipY51zTV4cwRHsTwmWeWiItjjXCG',
  'Ef_gdxqeMXQ_BGsYfnhkdPl8erkKLtIQYj_DsQ0GsvfqPZ7y',
  'Ef8x3O4TdAgl8uR693NT1EaaFnRX4XIgF4g_sPlbMxOvSO54',
  'Ef9D_DDYTQNE_gq_B0ZMb7hVyD0xDQtBANuRTvG_TjPB3Lwv',
  'Ef9Rn3RfeokXhf97zj1KiucfM8REWvHOfoigQ5cJxHu9LNOX',
  'Ef-uLQLQxfM2qRvFlqG4bTXhYRFhXijtbETU_uQxGzooOFBJ',
  'Ef8nYNVjegosbIUo5I8wzydKH92Szp1qNMOsK4tj9kir2OKs',
  'Ef_Hr1zj9aIv8TSGeoiXPzPPxedwDkFLigSxKcjWpcawXebV',
  'Ef8Wlt3f-jnGREZpwa1lsUrYo8keM9t0ed8sogr8I_2odw1N',
  'Ef8Gcgbql9vlG_N-2Mi1jG5qcbLTLGRXQEIQu8kcj-MzHdvM',
  'Ef-WQHvrEa3c5yLtMVx9HUFHmFu_Nq4qkZr4zRYDyADMxVoi',
  'Ef-coBspAWqOp6TiM3MD0PoK1K3TKUfI1dJlaiH0xXzzogg3',
  'Ef87WctCswjntSaMK9v0qQ1rpocDqPhMFNV83uRiXdaW5IlK',
  'Ef_6GzjrGRGPi3SYSN4eevUYCYra8_6S2HP7LoTBeTy80xlE',
  'Ef8TQftIscVXbeDxgOLSZFzT6IB8UVYW_wjU2ILzM-fkHC-0',
  'Ef9-rhuaB4VpoO-kF2rd0_lFlT5naXq880nwJpyJcI_H4Fjc',
  'Ef8yPdVrfJaSR_Mr44l4aqtsHpFgTixEs7kGRn2siEk34XDf',
  'Ef9Y9jjAp3L21XlQVVlIzIDfF2cdsPN4ENJmYiq715fqoSvc',
  'Ef9vlWEvo3jAXLtLsZjezLFHPSese13AS-oW4VI-B8y_fp0A',
  'Ef9xh0d3UsirbwGBvsHgJ-bDQ099EOGb5ufNJsFRTroSg8ko',
  'Ef-vJ5qAl-H4DqFvHwSsReT6Jz-7uXLCNKBMw6mzh953K5Gm',
  'Ef8pql5JLRqsGLQmDj4hJl5wG_LSdY3N2Nnfk42NA3-44z2j',
  'Ef9V7Cb-w7ci2_ccsgRGpo0ipeZNOcyBw_g6k_BD4bvQEbPz',
  'Ef-Ki7p7hKL7dI4pGBHY0Uw_1zZzp39JSJ52Pcj7qLMYre4o',
  'Ef8oEWKe2PL3-I9uuz3hS0bMpOqQvkLGa2N-OiONzexki3ZX',
  'Ef_CNBs9uCmTeyKOIVuQdhDDagXAtU1PLSqlB4cj36hFtgS5',
  'Ef98E_p3EpHgwcsxnu2ZSww1zC2w9Hgcr-yIF5T6Hxd3eNlo',
  'Ef_VLkR-yheFNhzj2Q70NogDn9OUlVETDbN4Qk7zoop18ocp',
  'Ef-t_1Fi903WxFKA3ToY1qE01vFwlnQ1gnWCDYH0s3k3bjPQ',
  'Ef9x1iEruQxZ9ipCFrcWmotznZT45AxhYIAvrCD_ZjUefkWW',
  'Ef-NTeeLj-68mkKogKsYO__gJW9UKM2i3-0_32m22ChPrmzb',
  'Ef-KbQ2yGVPuvB3DvTaKsIe5eM5Uow02vg3CC8_GrcPusZgR',
  'Ef-2TDP9XUS6wnFmgBHLpK6yZ10zKn8obGVg37T7qIdoU5Di',
  'Ef8jsDan14FjQxpPStw_wolQsbE77KA9ay-MZVkjVET7a1qa',
  'Ef8TlfPw5RfZEKeuO0nDg20CH1lF5NYsK639Xn8c5zsyvzwl',
  'Ef-7RMpdHQjktyxSP0ncMMpSKdakW0Y5zf9RDGJuxGsFzty3',
  'Ef-T6yIGneTVd2DibuhwiuLIXDczfpHRcprh4sGywuB0iYYZ',
  'Ef_-lS7heSTy2FoqBV2VHC8bbxFpRfPzF8c8FbUZllRRgb-U',
  'Ef9Sx8ZknR4EIPaZWIbINXDT5Jv78Q7mUfhxJyM5LbEiL8Eq',
  'Ef8NYtRJqwrR5jB6LdVhdOaQcDjuUxDoZ9m_cdr055ANmPZD',
  'Ef-4UlbPcf46r7-Ry-KiE9SH36oTf65oIYRe5EJB-j2QSWd7',
  'Ef95lKyPF4TCic_VBuj-WO29cIzAxcMnhhMfIysR_pJTA6Cg',
  'Ef94tLex18A-CdNyvu6pF4_2zNXIOJjXu_Ht_lkQXfI0XzQM',
  'Ef9C93WJugEaKrgfe0uGwMnps7L59HlqXGKjl4oQB2A11ot6',
  'Ef8DQ_a08aGkG_rr0kEtgCg0Hmov6CUO2v7SXf5NQWDjkhav',
  'Ef-x0kGqH5JHnDqD_WIPNKHOSe9HJu1jlFQTvlpnaDdlIAG5',
  'Ef9iNnY833SwCnR3JRG9xe5sPVfzy78ERfD2esqDr8FRvdTa',
  'Ef__fLdvCDKtQuixub4_GgrzCC81Yw6NMgI3f3BR4T2HEYmA',
  'Ef9259tsR7GLNkKf4LGkWolQRLu_cUHrQV2eX8qS-SujEZou',
  'Ef8dQzYpabZFnZFcGlZj03Zjv1vBK9vzaKitWBrAfXMEQFrX',
  'Ef_XjAQx3LZRE416A9bl2f0zuQpbpHUAJjVPGTkkev8PIMtc',
  'Ef_CCdzJBeKB9bmrFWOlh_jk4OvrBgWjZIgrAHH30i5L1Uhj',
  'Ef-ksHvxGi-IqJbqbAMcvnT_V4_9p6Rl720b_z5ZWmcjQw4z',
  'Ef85zP5t0FO9rNB7zyEbO4sUIoznE7xbiBktG6RSMAgSBUJP',
  'Ef9F5bZLw3tmsBsyJ2AMDRWY3-RQTL2zh7R4EdMH7SEcg44s',
  'Ef-xtn5Dvk_qk-YGIUuVcOprFmuRgjKHGE5s7LwiAyQm1jgp',
  'Ef8q51P4YxQmMrsTDibyKmLup0IkLx8T-NQ_AEfbtV_gvmYa',
  'Ef_nXyF7IKqxf9N9Y2LPMlfwwL5Zi79HwqerOGFjz2IFBwGF',
  'Ef9ghQuBEDxcrvwfjiJ0Bea_qcms8kY3d2MXSJfUyRCW9uEi',
  'Ef8GB6T3wfb4XCo7qPJdubJtiR7-zLkZrcp5OtQrLHVjmgsT',
  'Ef-oNEo8DUdw0RDVRRim8_T1NeEgv55vrZTlhOZhI0esdO8-',
  'Ef83MDvYQSGcOTyoNHdDVzRRBHCgpiMBiTPxqLiLID0l2wEN',
  'Ef81pbWeWjnstpggaNReWlfGMep5pno2P0H0aRkIab_ZXrCp',
  'Ef9VKvdXs6FXC_kw9tXXL6GlOHlYLjeFgKOmCHbX4JufusAl',
  'Ef9Y5NJR9wIawnBKw1_XsFr03GgVFgn9d8_YUL0LJgP0amRX',
  'Ef9s95V4uqTt7j0vRlgNiqBAc9FpmJ06vhx_AJ--JVe_D5A6',
  'Ef9rh5TmcTJaoWl_84l40fxSKBUsQ6R-4aCnNh8v2dpCSnaS',
];

export const waitForTransaction = async (
  provider: NetworkProvider,
  address: Address,
  action: string = "transaction",
  curTxLt: string | null = null,
  maxRetry: number = 15,
  interval: number=1000
) => {
  let done  = false;
  let count = 0;
  const ui  = provider.ui();
  let blockNum = (await provider.api().getLastBlock()).last.seqno;
  if(curTxLt == null) {
    let initialState = await provider.api().getAccount(blockNum, address);
    let lt = initialState?.account?.last?.lt;
    curTxLt = lt ? lt : null;
  }
  do {
    ui.write(`Awaiting ${action} completion (${++count}/${maxRetry})`);
    await sleep(interval);
    let newBlockNum = (await provider.api().getLastBlock()).last.seqno;
    if (blockNum == newBlockNum) {
      continue;
    }
    blockNum = newBlockNum;
    const curState = await provider.api().getAccount(blockNum, address);
    if(curState?.account?.last !== null){
      done = curState?.account?.last?.lt !== curTxLt;
    }
  } while(!done && count < maxRetry);
  return done;
}
