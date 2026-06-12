/**
 * BOSS 直聘 geek contact — 求职者主动联系招聘者（发起沟通）
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { requirePage, navigateToGeekChat, bossFetch, verbose } from './utils.js';

cli({
    site: 'boss',
    name: 'contact',
    access: 'write',
    description: 'BOSS 直聘求职者主动联系招聘者（发起沟通）',
    domain: 'www.zhipin.com',
    strategy: Strategy.COOKIE,
    navigateBefore: false,
    browser: true,
    args: [
        { name: 'boss-id', positional: true, required: true, help: '招聘者 ID（从 search 结果的 bossId 字段获取）' },
        { name: 'job-id', required: true, help: '职位 ID（encryptJobId，从 search 结果获取）' },
        { name: 'security-id', required: true, help: '职位安全 ID（从 search 结果的 security_id 字段获取）' },
        { name: 'text', default: '', help: '自定义招呼语（为空则使用默认模板）' },
    ],
    columns: ['status', 'detail'],
    func: async (page, kwargs) => {
        requirePage(page);
        const bossId = kwargs['boss-id'];
        const jobId = kwargs['job-id'];
        const securityId = kwargs['security-id'];
        
        verbose(`Contacting boss ${bossId} for job ${jobId}...`);
        
        // Navigate to geek chat page to establish cookie context
        await navigateToGeekChat(page, 3);
        
        // Read encryptSystemId required for geek-side API calls
        const encryptSystemId = await page.evaluate(`
            (() => {
                try {
                    const appEl = document.querySelector('#app') || document.querySelector('[data-v-app]');
                    const vueApp = appEl && (appEl.__vue_app__ || appEl._vei);
                    if (vueApp) {
                        const pinia = vueApp.config && vueApp.config.globalProperties.$pinia;
                        if (pinia && pinia.state && pinia.state.value) {
                            for (const store of Object.values(pinia.state.value)) {
                                try {
                                    const flat = JSON.stringify(store);
                                    if (flat.includes('encryptSystemId')) {
                                        const m = flat.match(/"encryptSystemId":"([^"]+)"/);
                                        if (m) return m[1];
                                    }
                                } catch (_) {}
                            }
                        }
                    }
                } catch (_) {}
                try {
                    const entries = performance.getEntriesByType('resource');
                    for (const entry of entries) {
                        if (!entry.name.includes('geekFilterByLabel')) continue;
                        const u = new URL(entry.name);
                        const v = u.searchParams.get('encryptSystemId');
                        if (v) return v;
                    }
                } catch (_) {}
                return '';
            })()
        `);
        
        // Use the geek-side API to initiate chat with a recruiter
        // This API creates a chat session and sends an initial greeting
        const params = new URLSearchParams({
            bossId: String(bossId),
            jobId: String(jobId),
            securityId: String(securityId),
            encryptSystemId: String(encryptSystemId || ''),
            content: kwargs.text || '您好，我对这个职位很感兴趣，希望能进一步沟通！',
        });
        
        const data = await bossFetch(page, 'https://www.zhipin.com/wapi/zpchat/geek/contact', {
            method: 'POST',
            body: params.toString(),
        });
        
        if (data.code === 0) {
            return [{ 
                status: '✅ 沟通已发起', 
                detail: `已向招聘者发送消息：${kwargs.text || '您好，我对这个职位很感兴趣，希望能进一步沟通！'}` 
            }];
        } else {
            throw new Error(`联系失败：${data.message || '未知错误'} (code=${data.code})`);
        }
    },
});
