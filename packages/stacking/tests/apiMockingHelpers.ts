import { Configuration, TransactionsApi } from '@stacks/blockchain-api-client';
import { StacksTestnet } from '@stacks/network';
import { MockResponseInitFunction } from 'jest-fetch-mock';
import { PoxInfo, StackingClient } from '../src';

// Helpers for creating tests with unmocked environments =======================

const MATCHER = {
  ALL: /.*/,
};

// todo: maybe something similar could be generalized to work in all package tests
export function setApiMocks(responseMap: { [key: string]: any }, mockTxBroadcast = true) {
  // we want to be able to call setApiMocks and it do nothing if mocking is currently disabled
  // (maybe move this to inside the mockIf handler, for better enabling/disabling mocking during a run)
  if (!isMocking()) return;

  if (mockTxBroadcast)
    responseMap = {
      '/v2/transactions': V2_TXS,
      '/v2/fees/transaction': V2_FEES,
      ...responseMap,
    };

  // eslint-disable-next-line @typescript-eslint/require-await
  fetchMock.mockIf(MATCHER.ALL, (async (request: Request) => {
    const { path } = (request as any)[Object.getOwnPropertySymbols(request)[1]].parsedURL; // may depend on js runtime

    if (!responseMap.hasOwnProperty(path)) {
      return console.log(`☐ Not mocking '${path}'`);
    }

    if (process.env.NODE_DEBUG) {
      console.log(`☑︎ Mocking '${path}'`);
    }

    const response = responseMap[path as string];
    if (typeof response === 'string') return response;
    return JSON.stringify(response);
  }) as MockResponseInitFunction);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isMocking(): boolean {
  const result = fetchMock.isMocking(''); // be careful using .isMocking, it will consume .mockOnce's
  if (typeof result === 'boolean') return result;
  return result[0];
}

const MAX_ITERATIONS = 120;
const ITERATION_INTERVAL = 1000;

export async function waitForTx(txId: string, apiUrl = 'http://localhost:3999') {
  if (isMocking()) return;

  const txApi = new TransactionsApi(new Configuration({ basePath: apiUrl }));

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    try {
      const txInfo = (await txApi.getTransactionById({ txId })) as any;
      console.log('txInfo', txInfo);
      if (txInfo?.tx_status === 'success') {
        console.log(`✓ ${JSON.stringify(txInfo?.tx_result)}`);
        return txInfo;
      } else if (txInfo?.tx_result) {
        return console.log(`✕ ${JSON.stringify(txInfo.tx_result)}`);
      }
    } catch (e: any) {
      if (e?.ok === false) throw Error(`✕ ${e?.status}: ${txId}`);
      throw e;
    }
    console.log(`waiting (${i}x)`);
    await sleep(ITERATION_INTERVAL);
  }
}

export async function waitForBlock(burnBlockId: number, client?: StackingClient) {
  if (isMocking()) return;

  client = client ?? new StackingClient('', new StacksTestnet({ url: 'http://localhost:3999' }));

  let current: number;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    try {
      const poxInfo = (await client.getPoxInfo()) as PoxInfo;
      current = poxInfo?.current_burnchain_block_height as number;
      if (current && current >= burnBlockId) {
        console.log(`→ block ${current} reached`);
        return;
      }
    } catch (e: any) {
      throw e;
    }
    console.log(`waiting (${i}x) for block ${burnBlockId} (current block: ${current})`);
    await sleep(ITERATION_INTERVAL);
  }
}

// todo: add more generic method (ie merge with previous method)
export async function waitForCycle(cycleId: number, client?: StackingClient) {
  if (isMocking()) return;

  client = client ?? new StackingClient('', new StacksTestnet({ url: 'http://localhost:3999' }));

  let current: number;
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    try {
      const poxInfo = (await client.getPoxInfo()) as PoxInfo;
      current = poxInfo?.reward_cycle_id;
      if (current && current >= cycleId) {
        console.log(`→ cycle ${current} reached`);
        return;
      }
    } catch (e: any) {
      throw e;
    }
    console.log(`waiting (${i}x) for cycle ${cycleId} (current cycle: ${current})`);
    await sleep(ITERATION_INTERVAL);
  }
}

// === PATHS ===================================================================
export const V2_TXS = `"0288d0bde0b0f88fad0827e35b757efec3a0cf7886c1614bfc4f81c40030a14a"`;
export const V2_FEES = `{"estimated_cost":{"write_length":1138,"write_count":10,"read_length":60638,"read_count":34,"runtime":645443},"estimated_cost_scalar":12,"estimations":[{"fee_rate":1083.4556141387698,"fee":13001},{"fee_rate":1083.4556141387698,"fee":13001},{"fee_rate":1083.4556141387698,"fee":13001}],"cost_scalar_change_by_byte":0.00476837158203125}`;
export const V2_POX_REGTEST = `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600138752237389,"first_burnchain_block_height":0,"current_burnchain_block_height":8249,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60013875223738910,"current_cycle":{"id":1649,"min_threshold_ustx":1875440000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":1650,"min_threshold_ustx":1875440000000000,"min_increment_ustx":7501734402967,"stacked_ustx":0,"prepare_phase_start_block_height":8249,"blocks_until_prepare_phase":0,"reward_phase_start_block_height":8250,"blocks_until_reward_phase":1,"ustx_until_pox_rejection":1589413198036825600},"min_amount_ustx":1875440000000000,"prepare_cycle_length":1,"reward_cycle_id":1649,"reward_cycle_length":5,"rejection_votes_left_required":1589413198036825600,"next_reward_cycle_in":1,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":104,"first_reward_cycle_id":21}]}`;
export const V2_POX_STACKS_TEL = `{"contract_id":"ST000000000000000000002AMW42H.pox-2","pox_activation_threshold_ustx":600666564165569,"first_burnchain_block_height":0,"current_burnchain_block_height":60989,"prepare_phase_block_length":1,"reward_phase_block_length":4,"reward_slots":8,"rejection_fraction":3333333333333333,"total_liquid_supply_ustx":60066656416556970,"current_cycle":{"id":12197,"min_threshold_ustx":1877090000000000,"stacked_ustx":0,"is_pox_active":false},"next_cycle":{"id":12198,"min_threshold_ustx":1877090000000000,"min_increment_ustx":7508332052069,"stacked_ustx":0,"prepare_phase_start_block_height":60989,"blocks_until_prepare_phase":0,"reward_phase_start_block_height":60990,"blocks_until_reward_phase":1,"ustx_until_pox_rejection":11416974460158247000},"min_amount_ustx":1877090000000000,"prepare_cycle_length":1,"reward_cycle_id":12197,"reward_cycle_length":5,"rejection_votes_left_required":11416974460158247000,"next_reward_cycle_in":1,"contract_versions":[{"contract_id":"ST000000000000000000002AMW42H.pox","activation_burnchain_block_height":0,"first_reward_cycle_id":0},{"contract_id":"ST000000000000000000002AMW42H.pox-2","activation_burnchain_block_height":104,"first_reward_cycle_id":21}]}`;
export const V2_POX_INTERFACE_POX_2 = `{"functions":[{"name":"add-pox-addr-to-ith-reward-cycle","access":"private","args":[{"name":"cycle-index","type":"uint128"},{"name":"params","type":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"first-reward-cycle","type":"uint128"},{"name":"i","type":"uint128"},{"name":"num-cycles","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-set-indexes","type":{"list":{"type":"uint128","length":12}}},{"name":"stacker","type":{"optional":"principal"}}]}}],"outputs":{"type":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"first-reward-cycle","type":"uint128"},{"name":"i","type":"uint128"},{"name":"num-cycles","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-set-indexes","type":{"list":{"type":"uint128","length":12}}},{"name":"stacker","type":{"optional":"principal"}}]}}},{"name":"add-pox-addr-to-reward-cycles","access":"private","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"first-reward-cycle","type":"uint128"},{"name":"num-cycles","type":"uint128"},{"name":"amount-ustx","type":"uint128"},{"name":"stacker","type":"principal"}],"outputs":{"type":{"response":{"ok":{"list":{"type":"uint128","length":12}},"error":"int128"}}}},{"name":"add-pox-partial-stacked","access":"private","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"first-reward-cycle","type":"uint128"},{"name":"num-cycles","type":"uint128"},{"name":"amount-ustx","type":"uint128"}],"outputs":{"type":"bool"}},{"name":"add-pox-partial-stacked-to-ith-cycle","access":"private","args":[{"name":"cycle-index","type":"uint128"},{"name":"params","type":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"num-cycles","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"}]}}],"outputs":{"type":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"num-cycles","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"}]}}},{"name":"append-reward-cycle-pox-addr","access":"private","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"},{"name":"amount-ustx","type":"uint128"},{"name":"stacker","type":{"optional":"principal"}}],"outputs":{"type":"uint128"}},{"name":"fold-unlock-reward-cycle","access":"private","args":[{"name":"set-index","type":"uint128"},{"name":"data-res","type":{"response":{"ok":{"tuple":[{"name":"cycle","type":"uint128"},{"name":"first-unlocked-cycle","type":"uint128"},{"name":"stacker","type":"principal"}]},"error":"int128"}}}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"cycle","type":"uint128"},{"name":"first-unlocked-cycle","type":"uint128"},{"name":"stacker","type":"principal"}]},"error":"int128"}}}},{"name":"handle-unlock","access":"private","args":[{"name":"user","type":"principal"},{"name":"amount-locked","type":"uint128"},{"name":"cycle-to-unlock","type":"uint128"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"increase-reward-cycle-entry","access":"private","args":[{"name":"reward-cycle-index","type":"uint128"},{"name":"updates","type":{"optional":{"tuple":[{"name":"add-amount","type":"uint128"},{"name":"first-cycle","type":"uint128"},{"name":"reward-cycle","type":"uint128"},{"name":"stacker","type":"principal"}]}}}],"outputs":{"type":{"optional":{"tuple":[{"name":"add-amount","type":"uint128"},{"name":"first-cycle","type":"uint128"},{"name":"reward-cycle","type":"uint128"},{"name":"stacker","type":"principal"}]}}}},{"name":"inner-stack-aggregation-commit","access":"private","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":{"response":{"ok":"uint128","error":"int128"}}}},{"name":"allow-contract-caller","access":"public","args":[{"name":"caller","type":"principal"},{"name":"until-burn-ht","type":{"optional":"uint128"}}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"delegate-stack-extend","access":"public","args":[{"name":"stacker","type":"principal"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"extend-count","type":"uint128"}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"stacker","type":"principal"},{"name":"unlock-burn-height","type":"uint128"}]},"error":"int128"}}}},{"name":"delegate-stack-increase","access":"public","args":[{"name":"stacker","type":"principal"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"increase-by","type":"uint128"}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"stacker","type":"principal"},{"name":"total-locked","type":"uint128"}]},"error":"int128"}}}},{"name":"delegate-stack-stx","access":"public","args":[{"name":"stacker","type":"principal"},{"name":"amount-ustx","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"start-burn-ht","type":"uint128"},{"name":"lock-period","type":"uint128"}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"lock-amount","type":"uint128"},{"name":"stacker","type":"principal"},{"name":"unlock-burn-height","type":"uint128"}]},"error":"int128"}}}},{"name":"delegate-stx","access":"public","args":[{"name":"amount-ustx","type":"uint128"},{"name":"delegate-to","type":"principal"},{"name":"until-burn-ht","type":{"optional":"uint128"}},{"name":"pox-addr","type":{"optional":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}}}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"disallow-contract-caller","access":"public","args":[{"name":"caller","type":"principal"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"reject-pox","access":"public","args":[],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"revoke-delegate-stx","access":"public","args":[],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"set-burnchain-parameters","access":"public","args":[{"name":"first-burn-height","type":"uint128"},{"name":"prepare-cycle-length","type":"uint128"},{"name":"reward-cycle-length","type":"uint128"},{"name":"rejection-fraction","type":"uint128"},{"name":"begin-2-1-reward-cycle","type":"uint128"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"stack-aggregation-commit","access":"public","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"stack-aggregation-commit-indexed","access":"public","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":{"response":{"ok":"uint128","error":"int128"}}}},{"name":"stack-aggregation-increase","access":"public","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"},{"name":"reward-cycle-index","type":"uint128"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"stack-extend","access":"public","args":[{"name":"extend-count","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"stacker","type":"principal"},{"name":"unlock-burn-height","type":"uint128"}]},"error":"int128"}}}},{"name":"stack-increase","access":"public","args":[{"name":"increase-by","type":"uint128"}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"stacker","type":"principal"},{"name":"total-locked","type":"uint128"}]},"error":"int128"}}}},{"name":"stack-stx","access":"public","args":[{"name":"amount-ustx","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"start-burn-ht","type":"uint128"},{"name":"lock-period","type":"uint128"}],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"lock-amount","type":"uint128"},{"name":"stacker","type":"principal"},{"name":"unlock-burn-height","type":"uint128"}]},"error":"int128"}}}},{"name":"burn-height-to-reward-cycle","access":"read_only","args":[{"name":"height","type":"uint128"}],"outputs":{"type":"uint128"}},{"name":"can-stack-stx","access":"read_only","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"amount-ustx","type":"uint128"},{"name":"first-reward-cycle","type":"uint128"},{"name":"num-cycles","type":"uint128"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"check-caller-allowed","access":"read_only","args":[],"outputs":{"type":"bool"}},{"name":"check-pox-addr-hashbytes","access":"read_only","args":[{"name":"version","type":{"buffer":{"length":1}}},{"name":"hashbytes","type":{"buffer":{"length":32}}}],"outputs":{"type":"bool"}},{"name":"check-pox-addr-version","access":"read_only","args":[{"name":"version","type":{"buffer":{"length":1}}}],"outputs":{"type":"bool"}},{"name":"check-pox-lock-period","access":"read_only","args":[{"name":"lock-period","type":"uint128"}],"outputs":{"type":"bool"}},{"name":"current-pox-reward-cycle","access":"read_only","args":[],"outputs":{"type":"uint128"}},{"name":"get-allowance-contract-callers","access":"read_only","args":[{"name":"sender","type":"principal"},{"name":"calling-contract","type":"principal"}],"outputs":{"type":{"optional":{"tuple":[{"name":"until-burn-ht","type":{"optional":"uint128"}}]}}}},{"name":"get-check-delegation","access":"read_only","args":[{"name":"stacker","type":"principal"}],"outputs":{"type":{"optional":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"delegated-to","type":"principal"},{"name":"pox-addr","type":{"optional":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}}},{"name":"until-burn-ht","type":{"optional":"uint128"}}]}}}},{"name":"get-delegation-info","access":"read_only","args":[{"name":"stacker","type":"principal"}],"outputs":{"type":{"optional":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"delegated-to","type":"principal"},{"name":"pox-addr","type":{"optional":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}}},{"name":"until-burn-ht","type":{"optional":"uint128"}}]}}}},{"name":"get-num-reward-set-pox-addresses","access":"read_only","args":[{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":"uint128"}},{"name":"get-partial-stacked-by-cycle","access":"read_only","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"},{"name":"sender","type":"principal"}],"outputs":{"type":{"optional":{"tuple":[{"name":"stacked-amount","type":"uint128"}]}}}},{"name":"get-pox-info","access":"read_only","args":[],"outputs":{"type":{"response":{"ok":{"tuple":[{"name":"current-rejection-votes","type":"uint128"},{"name":"first-burnchain-block-height","type":"uint128"},{"name":"min-amount-ustx","type":"uint128"},{"name":"prepare-cycle-length","type":"uint128"},{"name":"rejection-fraction","type":"uint128"},{"name":"reward-cycle-id","type":"uint128"},{"name":"reward-cycle-length","type":"uint128"},{"name":"total-liquid-supply-ustx","type":"uint128"}]},"error":"none"}}}},{"name":"get-pox-rejection","access":"read_only","args":[{"name":"stacker","type":"principal"},{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":{"optional":{"tuple":[{"name":"amount","type":"uint128"}]}}}},{"name":"get-reward-set-pox-address","access":"read_only","args":[{"name":"reward-cycle","type":"uint128"},{"name":"index","type":"uint128"}],"outputs":{"type":{"optional":{"tuple":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"stacker","type":{"optional":"principal"}},{"name":"total-ustx","type":"uint128"}]}}}},{"name":"get-reward-set-size","access":"read_only","args":[{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":"uint128"}},{"name":"get-stacker-info","access":"read_only","args":[{"name":"stacker","type":"principal"}],"outputs":{"type":{"optional":{"tuple":[{"name":"first-reward-cycle","type":"uint128"},{"name":"lock-period","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-set-indexes","type":{"list":{"type":"uint128","length":12}}}]}}}},{"name":"get-stacking-minimum","access":"read_only","args":[],"outputs":{"type":"uint128"}},{"name":"get-total-pox-rejection","access":"read_only","args":[{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":"uint128"}},{"name":"get-total-ustx-stacked","access":"read_only","args":[{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":"uint128"}},{"name":"is-pox-active","access":"read_only","args":[{"name":"reward-cycle","type":"uint128"}],"outputs":{"type":"bool"}},{"name":"minimal-can-stack-stx","access":"read_only","args":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"amount-ustx","type":"uint128"},{"name":"first-reward-cycle","type":"uint128"},{"name":"num-cycles","type":"uint128"}],"outputs":{"type":{"response":{"ok":"bool","error":"int128"}}}},{"name":"next-cycle-rejection-votes","access":"read_only","args":[],"outputs":{"type":"uint128"}},{"name":"reward-cycle-to-burn-height","access":"read_only","args":[{"name":"cycle","type":"uint128"}],"outputs":{"type":"uint128"}}],"variables":[{"name":"ADDRESS_VERSION_NATIVE_P2TR","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ADDRESS_VERSION_NATIVE_P2WPKH","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ADDRESS_VERSION_NATIVE_P2WSH","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ADDRESS_VERSION_P2PKH","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ADDRESS_VERSION_P2SH","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ADDRESS_VERSION_P2WPKH","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ADDRESS_VERSION_P2WSH","type":{"buffer":{"length":1}},"access":"constant"},{"name":"ERR_DELEGATION_EXPIRES_DURING_LOCK","type":"int128","access":"constant"},{"name":"ERR_DELEGATION_NO_REWARD_SLOT","type":"int128","access":"constant"},{"name":"ERR_DELEGATION_POX_ADDR_REQUIRED","type":"int128","access":"constant"},{"name":"ERR_DELEGATION_TOO_MUCH_LOCKED","type":"int128","access":"constant"},{"name":"ERR_DELEGATION_WRONG_REWARD_SLOT","type":"int128","access":"constant"},{"name":"ERR_INVALID_START_BURN_HEIGHT","type":"int128","access":"constant"},{"name":"ERR_NOT_ALLOWED","type":"int128","access":"constant"},{"name":"ERR_NOT_CURRENT_STACKER","type":"int128","access":"constant"},{"name":"ERR_STACKING_ALREADY_DELEGATED","type":"int128","access":"constant"},{"name":"ERR_STACKING_ALREADY_REJECTED","type":"int128","access":"constant"},{"name":"ERR_STACKING_ALREADY_STACKED","type":"int128","access":"constant"},{"name":"ERR_STACKING_CORRUPTED_STATE","type":"int128","access":"constant"},{"name":"ERR_STACKING_EXPIRED","type":"int128","access":"constant"},{"name":"ERR_STACKING_INSUFFICIENT_FUNDS","type":"int128","access":"constant"},{"name":"ERR_STACKING_INVALID_AMOUNT","type":"int128","access":"constant"},{"name":"ERR_STACKING_INVALID_LOCK_PERIOD","type":"int128","access":"constant"},{"name":"ERR_STACKING_INVALID_POX_ADDRESS","type":"int128","access":"constant"},{"name":"ERR_STACKING_NO_SUCH_PRINCIPAL","type":"int128","access":"constant"},{"name":"ERR_STACKING_PERMISSION_DENIED","type":"int128","access":"constant"},{"name":"ERR_STACKING_POX_ADDRESS_IN_USE","type":"int128","access":"constant"},{"name":"ERR_STACKING_STX_LOCKED","type":"int128","access":"constant"},{"name":"ERR_STACKING_THRESHOLD_NOT_MET","type":"int128","access":"constant"},{"name":"ERR_STACKING_UNREACHABLE","type":"int128","access":"constant"},{"name":"ERR_STACK_EXTEND_NOT_LOCKED","type":"int128","access":"constant"},{"name":"ERR_STACK_INCREASE_NOT_LOCKED","type":"int128","access":"constant"},{"name":"MAX_ADDRESS_VERSION","type":"uint128","access":"constant"},{"name":"MAX_ADDRESS_VERSION_BUFF_20","type":"uint128","access":"constant"},{"name":"MAX_ADDRESS_VERSION_BUFF_32","type":"uint128","access":"constant"},{"name":"MAX_POX_REWARD_CYCLES","type":"uint128","access":"constant"},{"name":"MIN_POX_REWARD_CYCLES","type":"uint128","access":"constant"},{"name":"POX_REJECTION_FRACTION","type":"uint128","access":"constant"},{"name":"PREPARE_CYCLE_LENGTH","type":"uint128","access":"constant"},{"name":"REWARD_CYCLE_LENGTH","type":"uint128","access":"constant"},{"name":"STACKING_THRESHOLD_100","type":"uint128","access":"constant"},{"name":"STACKING_THRESHOLD_25","type":"uint128","access":"constant"},{"name":"configured","type":"bool","access":"variable"},{"name":"first-2-1-reward-cycle","type":"uint128","access":"variable"},{"name":"first-burnchain-block-height","type":"uint128","access":"variable"},{"name":"pox-prepare-cycle-length","type":"uint128","access":"variable"},{"name":"pox-rejection-fraction","type":"uint128","access":"variable"},{"name":"pox-reward-cycle-length","type":"uint128","access":"variable"}],"maps":[{"name":"allowance-contract-callers","key":{"tuple":[{"name":"contract-caller","type":"principal"},{"name":"sender","type":"principal"}]},"value":{"tuple":[{"name":"until-burn-ht","type":{"optional":"uint128"}}]}},{"name":"delegation-state","key":{"tuple":[{"name":"stacker","type":"principal"}]},"value":{"tuple":[{"name":"amount-ustx","type":"uint128"},{"name":"delegated-to","type":"principal"},{"name":"pox-addr","type":{"optional":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}}},{"name":"until-burn-ht","type":{"optional":"uint128"}}]}},{"name":"partial-stacked-by-cycle","key":{"tuple":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-cycle","type":"uint128"},{"name":"sender","type":"principal"}]},"value":{"tuple":[{"name":"stacked-amount","type":"uint128"}]}},{"name":"reward-cycle-pox-address-list","key":{"tuple":[{"name":"index","type":"uint128"},{"name":"reward-cycle","type":"uint128"}]},"value":{"tuple":[{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"stacker","type":{"optional":"principal"}},{"name":"total-ustx","type":"uint128"}]}},{"name":"reward-cycle-pox-address-list-len","key":{"tuple":[{"name":"reward-cycle","type":"uint128"}]},"value":{"tuple":[{"name":"len","type":"uint128"}]}},{"name":"reward-cycle-total-stacked","key":{"tuple":[{"name":"reward-cycle","type":"uint128"}]},"value":{"tuple":[{"name":"total-ustx","type":"uint128"}]}},{"name":"stacking-rejection","key":{"tuple":[{"name":"reward-cycle","type":"uint128"}]},"value":{"tuple":[{"name":"amount","type":"uint128"}]}},{"name":"stacking-rejectors","key":{"tuple":[{"name":"reward-cycle","type":"uint128"},{"name":"stacker","type":"principal"}]},"value":{"tuple":[{"name":"amount","type":"uint128"}]}},{"name":"stacking-state","key":{"tuple":[{"name":"stacker","type":"principal"}]},"value":{"tuple":[{"name":"first-reward-cycle","type":"uint128"},{"name":"lock-period","type":"uint128"},{"name":"pox-addr","type":{"tuple":[{"name":"hashbytes","type":{"buffer":{"length":32}}},{"name":"version","type":{"buffer":{"length":1}}}]}},{"name":"reward-set-indexes","type":{"list":{"type":"uint128","length":12}}}]}}],"fungible_tokens":[],"non_fungible_tokens":[],"clarity_version":"Clarity2"}`;

// === MOCK MAPS ===============================================================
export const MOCK_POX_2_REGTEST = {
  '/v2/fees/transaction': V2_FEES,
  '/v2/pox': V2_POX_REGTEST,
  '/v2/contracts/interface/ST000000000000000000002AMW42H/pox-2': V2_POX_INTERFACE_POX_2,
  '/v2/data_var/ST000000000000000000002AMW42H/pox-2/configured?proof=0': `{"data":"0x03"}`,
};

export const MOCK_EMPTY_ACCOUNT = {
  '/v2/pox': V2_POX_STACKS_TEL,
  '/v2/accounts/ST162GBCTD9ESBF09XC2T63NCX6ZKS42ZPWGXZ6VH?proof=0': `{"balance":"0x00000000000000000000000000000000","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":0}`,
  '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/can-stack-stx': `{"okay":true,"result":"0x08000000000000000000000000000000000b"}`,
};

export const MOCK_FULL_ACCOUNT = {
  '/v2/pox': V2_POX_STACKS_TEL,
  '/v2/accounts/STB44HYPYAT2BB2QE513NSP81HTMYWBJP02HPGK6?proof=0': `{"balance":"0x0000000000000000002386f26fb76310","locked":"0x00000000000000000000000000000000","unlock_height":0,"nonce":63}`,
  '/v2/contracts/call-read/ST000000000000000000002AMW42H/pox-2/can-stack-stx': `{"okay":true,"result":"0x0703"}`,
};

// === FETCHMOCK TESTING HELPERS ===============================================

/**
 * Gets latest fetchMock broadcast to /transactions
 * @ignore
 */
export function getFetchMockBroadcast() {
  const broadcast = (Array.from(fetchMock.mock.calls) as any)
    .reverse()
    .find((m: any) => m[0].endsWith('/transactions'));
  return {
    body: broadcast[1].body,
  };
}
