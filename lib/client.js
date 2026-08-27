/**
 * Balance-chip client half (hand-built ModuleLoader bundle, plain JS).
 * Renders a live account-balance pill in the composer tool row, immediately
 * right of the permission-switch control, and keeps it fresh: initial fetch,
 * a 15s poll while the tab is visible, refetch on window focus, on session
 * switch, and whenever a submitted turn finishes (input phase leaves
 * submitting/adjudicating). Clicking the pill refreshes immediately.
 *
 * Alert: when the balance drops to (or below) the user-set warning threshold
 * (configured in Settings → General → 余额预警), the pill's border turns red
 * and pulses. Threshold is persisted in localStorage.
 */
window.__ModuleLoader__.load({
	id: '@dsh-external/dsh-client-ui-balance-chip',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
		let react = require('react');

		//#region constants
		const BALANCE_ROUTE = '/api/dsh/balance';
		/** DeepSeek Open Platform user console (balance & usage page). */
		const PLATFORM_URL = 'https://platform.deepseek.com/usage';
		const POLL_INTERVAL_MS = 15000;
		const BUSY_PHASES = new Set(['submitting', 'adjudicating']);
		const STYLE_TAG_ID = '@dsh-external/dsh-client-ui-balance-chip/styles';
		const NS = 'balance-chip';
		const THRESHOLD_KEY = 'dsh-balance-chip.threshold';
		//#endregion

		//#region locale dictionaries
		const zh = {
			'row.title': '余额预警',
			'row.description': '当账户余额低于该金额时，输入框左下角的余额胶囊会亮起红边框提醒。设为 0 关闭。',
			'row.placeholder': '例如 20',
		};
		const en = {
			'row.title': 'Balance alert',
			'row.description': 'When the account balance drops below this amount, the balance chip in the composer turns a red border. Set 0 to disable.',
			'row.placeholder': 'e.g. 20',
		};
		//#endregion

		//#region threshold store (module-level, localStorage-backed)
		function safeStorage() {
			try {
				return typeof localStorage === 'undefined' ? null : localStorage;
			} catch {
				return null;
			}
		}

		function readStoredThreshold() {
			const storage = safeStorage();
			if (storage === null) return 0;
			try {
				const raw = storage.getItem(THRESHOLD_KEY);
				if (raw === null) return 0;
				const value = Number(raw);
				return Number.isFinite(value) && value > 0 ? value : 0;
			} catch {
				return 0;
			}
		}

		let thresholdCache = readStoredThreshold();
		const thresholdListeners = new Set();

		function getThreshold() {
			return thresholdCache;
		}

		function setThreshold(value) {
			const next = Number.isFinite(value) && value > 0 ? value : 0;
			if (next === thresholdCache) return;
			thresholdCache = next;
			const storage = safeStorage();
			if (storage !== null) {
				try {
					storage.setItem(THRESHOLD_KEY, String(next));
				} catch {
					// Persistence is best-effort; the in-memory value still applies.
				}
			}
			for (const listener of thresholdListeners) listener();
		}

		function subscribeThreshold(listener) {
			thresholdListeners.add(listener);
			return () => {
				thresholdListeners.delete(listener);
			};
		}
		//#endregion

		//#region helpers
		/** Host-language heuristic shared with the skins: zh* counts as Chinese. */
		function uiLang() {
			return (document.documentElement.lang || window.navigator.language || 'en')
				.toLowerCase().startsWith('zh') ? 'zh' : 'en';
		}

		function formatAmount(value) {
			const number = Number(value);
			if (!Number.isFinite(number)) return String(value);
			return number.toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});
		}

		function formatCurrency(amount, currency) {
			const text = formatAmount(amount);
			switch (currency) {
				case 'CNY': return `¥${text}`;
				case 'USD': return `$${text}`;
				case 'EUR': return `€${text}`;
				case 'JPY': return `¥${text}`;
				default: return currency ? `${currency} ${text}` : text;
			}
		}

		/** Install the chip + settings-row stylesheet once per page; returns the disposer. */
		function installStyles() {
			if (document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`) !== null) {
				return () => {};
			}
			const tag = document.createElement('style');
			tag.dataset.plugin = '@dsh-external/dsh-client-ui-balance-chip';
			tag.dataset.pluginCss = STYLE_TAG_ID;
			tag.textContent = [
				'.dsh-balance-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;',
				'box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:999px;',
				'background:var(--dsw-alias-bg-module-platform,rgba(128,128,128,.12));text-decoration:none;',
				'color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:13px;font-weight:500;line-height:20px;',
				'cursor:pointer;white-space:nowrap;user-select:none;}',
				'.dsh-balance-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));',
				'border-color:var(--dsw-alias-label-tertiary,#8a8f98);',
				'color:var(--dsw-alias-label-primary,#1f2329);}',
				'.dsh-balance-chip:active:not(:disabled){transform:translateY(1px);}',
				'.dsh-balance-chip:disabled{cursor:default;}',
				'.dsh-balance-chip-dot{width:6px;height:6px;border-radius:50%;background:#9aa0aa;flex:none;}',
				'.dsh-balance-chip[data-tone="ready"] .dsh-balance-chip-dot{background:#34c759;}',
				'.dsh-balance-chip[data-tone="error"] .dsh-balance-chip-dot{background:#ff453a;}',
				'.dsh-balance-chip[data-tone="pending"] .dsh-balance-chip-dot{background:#ffb800;}',
				'.dsh-balance-chip-text{overflow:hidden;text-overflow:ellipsis;max-width:180px;}',
				'@keyframes dsh-balance-alert-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,69,58,.35)}',
				'50%{box-shadow:0 0 0 4px rgba(255,69,58,0)}}',
				'.dsh-balance-chip[data-alert]{border-color:var(--dsw-alias-state-error-primary,#ff453a);',
				'color:var(--dsw-alias-state-error-primary,#ff453a);animation:dsh-balance-alert-pulse 1.8s ease-out infinite;}',
				'.dsh-balance-chip[data-alert] .dsh-balance-chip-dot{background:var(--dsw-alias-state-error-primary,#ff453a);}',
				'@media (prefers-reduced-motion:reduce){.dsh-balance-chip[data-alert]{animation:none}}',
				'.dsh-balance-row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}',
				'.dsh-balance-rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}',
				'.dsh-balance-rowTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}',
				'.dsh-balance-rowDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
				'.dsh-balance-rowInput{box-sizing:border-box;width:140px;height:36px;flex:none;',
				'background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);',
				'border:1px solid var(--dsw-alias-border-l2);border-radius:12px;outline:none;padding:0 12px;',
				'font:inherit;font-size:14px;line-height:22px}',
				'.dsh-balance-rowInput:focus{border-color:var(--dsw-alias-state-business-primary)}',
			].join('');
			document.head.appendChild(tag);
			return () => { tag.remove(); };
		}
		//#endregion

		//#region BalanceThresholdRow (Settings → General)
		/**
		 * One preference row inside the General section: the warning threshold.
		 * @param props - `t` (locale binder for NS) from the settings owner.
		 */
		function BalanceThresholdRow({ t }) {
			const threshold = react.useSyncExternalStore(subscribeThreshold, getThreshold);
			const [draft, setDraft] = react.useState(threshold > 0 ? String(threshold) : '');

			react.useEffect(() => {
				setDraft(threshold > 0 ? String(threshold) : '');
			}, [threshold]);

			const commit = (raw) => {
				setDraft(raw);
				if (raw.trim() === '') {
					setThreshold(0);
					return;
				}
				const value = Number(raw);
				if (Number.isFinite(value) && value >= 0) setThreshold(value);
			};

			return react.createElement('div', { className: 'dsh-balance-row' },
				react.createElement('div', { className: 'dsh-balance-rowText' },
					react.createElement('div', { className: 'dsh-balance-rowTitle' }, t('row.title')),
					react.createElement('div', { className: 'dsh-balance-rowDesc' }, t('row.description')),
				),
				react.createElement('input', {
					type: 'number',
					min: '0',
					step: '0.01',
					className: 'dsh-balance-rowInput',
					value: draft,
					placeholder: t('row.placeholder'),
					'aria-label': t('row.title'),
					onChange: (event) => commit(event.target.value),
					onBlur: () => setDraft(threshold > 0 ? String(threshold) : ''),
				}),
			);
		}
		//#endregion

		//#region BalanceChip
		/**
		 * Composer seat (`conversation.input.left`) rendering the balance pill.
		 * @param props - owner zone `{ session, input }`.
		 */
		function BalanceChip({ session, input }) {
			const [state, setState] = react.useState({ status: 'loading' });
			const busyRef = react.useRef(false);
			const mountedRef = react.useRef(true);
			const sessionRef = react.useRef(session?.sessionId);
			const prevBusyRef = react.useRef(false);
			const langRef = react.useRef(uiLang());
			const [langBump, setLangBump] = react.useState(0);
			const threshold = react.useSyncExternalStore(subscribeThreshold, getThreshold);

			const refresh = react.useCallback(() => {
				if (busyRef.current) return;
				busyRef.current = true;
				setState((current) => (
					current.status === 'ready'
						? { status: 'refreshing', value: current.value }
						: { status: 'loading' }
				));
				fetch(BALANCE_ROUTE, { credentials: 'same-origin' })
					.then((response) => response.json())
					.then((payload) => {
						if (!mountedRef.current) return;
						if (payload !== null && typeof payload === 'object'
							&& payload.ok === true
							&& payload.balance !== null && typeof payload.balance === 'object'
							&& Array.isArray(payload.balance.balance_infos)
							&& payload.balance.balance_infos.length > 0) {
							setState({ status: 'ready', value: payload.balance });
						} else {
							setState({
								status: 'error',
								error: (payload && typeof payload === 'object' && typeof payload.error === 'string')
									? payload.error
									: 'unknown',
							});
						}
					})
					.catch((error) => {
						if (!mountedRef.current) return;
						setState({
							status: 'error',
							error: error instanceof Error ? error.message : String(error),
						});
					})
					.finally(() => {
						busyRef.current = false;
					});
			}, []);

			react.useEffect(() => {
				mountedRef.current = true;
				refresh();
				const timer = setInterval(() => {
					if (!document.hidden) refresh();
				}, POLL_INTERVAL_MS);
				const onVisible = () => {
					if (!document.hidden) refresh();
				};
				document.addEventListener('visibilitychange', onVisible);
				// Follow the host UI language (document.documentElement.lang flips on switch).
				const langObserver = new MutationObserver(() => {
					const next = uiLang();
					if (next !== langRef.current) {
						langRef.current = next;
						setLangBump((n) => n + 1);
					}
				});
				langObserver.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ['lang'],
				});
				return () => {
					mountedRef.current = false;
					clearInterval(timer);
					document.removeEventListener('visibilitychange', onVisible);
					langObserver.disconnect();
				};
			}, [refresh]);

			// Refetch when the session changes (different workspace/conversation).
			react.useEffect(() => {
				const id = session?.sessionId;
				if (typeof id === 'string' && id !== '' && id !== sessionRef.current) {
					sessionRef.current = id;
					refresh();
				}
			}, [session?.sessionId, refresh]);

			// Instant update: a submitted turn ending (phase leaves
			// submitting/adjudicating) means the balance just moved.
			const busyNow = typeof input?.phase === 'string' && BUSY_PHASES.has(input.phase);
			react.useEffect(() => {
				if (prevBusyRef.current && !busyNow) refresh();
				prevBusyRef.current = busyNow;
			}, [busyNow, refresh]);

			void langBump;
			const zh = langRef.current === 'zh';

			// Alert state: primary (first) balance info at or below the threshold.
			let alert = false;
			let alertThresholdText = '';
			if (state.status === 'ready' && threshold > 0) {
				const primary = state.value.balance_infos[0];
				if (primary !== undefined && primary !== null) {
					const total = Number(primary.total_balance);
					if (Number.isFinite(total) && total <= threshold) {
						alert = true;
						alertThresholdText = formatCurrency(threshold, primary.currency);
					}
				}
			}

			let label;
			let title;
			let tone;
			if (state.status === 'loading' || state.status === 'refreshing') {
				label = zh ? '余额 …' : 'Balance …';
				title = zh ? '正在查询账户余额…' : 'Fetching account balance…';
				tone = 'pending';
			} else if (state.status === 'ready') {
				const infos = state.value.balance_infos;
				label = `${zh ? '余额' : 'Bal'} ${infos.map((info) => formatCurrency(info.total_balance, info.currency)).join('  ')}`;
				const breakdown = infos.map((info) => (
					zh
						? `${formatCurrency(info.total_balance, info.currency)} · 充值 ${formatCurrency(info.topped_up_balance, info.currency)} · 赠送 ${formatCurrency(info.granted_balance, info.currency)}`
						: `${formatCurrency(info.total_balance, info.currency)} · topped up ${formatCurrency(info.topped_up_balance, info.currency)} · granted ${formatCurrency(info.granted_balance, info.currency)}`
				)).join('\n');
				title = (alert
					? `${zh ? '⚠ 余额已低于预警值 ' : '⚠ Balance below alert threshold '}${alertThresholdText}\n`
					: '') + (zh
						? `账户余额\n${breakdown}\n点击前往 DeepSeek 开放平台`
						: `Account balance\n${breakdown}\nClick to open DeepSeek Open Platform`);
				tone = 'ready';
			} else {
				label = zh ? '余额 --' : 'Balance --';
				title = zh
					? `余额查询失败（${state.error ?? '未知错误'}）\n点击前往开放平台查看`
					: `Balance lookup failed (${state.error ?? 'unknown'})\nClick to open the platform`;
				tone = 'error';
			}

			const props = {
				className: 'dsh-balance-chip',
				href: PLATFORM_URL,
				target: '_blank',
				rel: 'noreferrer',
				'data-tone': tone,
				title,
				'aria-label': title,
			};
			if (alert) props['data-alert'] = '';

			return react.createElement(
				'a',
				props,
				react.createElement('span', { className: 'dsh-balance-chip-dot' }),
				react.createElement('span', { className: 'dsh-balance-chip-text' }, label),
			);
		}
		//#endregion

		//#region plugin
		/** Required services (cordis fiber inject). */
		const inject = ['slots', 'locale'];

		/**
		 * Client plugin body: register the balance pill into the composer tool
		 * row (right of the permission switch) and the alert-threshold row into
		 * Settings → General.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-balance-chip: dictionaries');
			ctx.effect(() => installStyles(), 'ui-balance-chip: stylesheet');
			ctx.slots.inject('settings.general.item', () => ctx.slots.register({
				name: 'settings.general.item',
				id: 'balance-chip',
				order: 50,
				locale: NS,
			}, BalanceThresholdRow));
			ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
				name: 'conversation.input.left',
				id: 'balance-chip',
				order: 0,
			}, BalanceChip));
		}
		//#endregion

		exports.BalanceChip = BalanceChip;
		exports.BalanceThresholdRow = BalanceThresholdRow;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
