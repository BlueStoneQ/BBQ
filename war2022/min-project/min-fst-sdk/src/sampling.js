/**
 * 整个FST算法分2套：
 * 1. 由setData驱动的sampling中 会判定靶点是否到底（页面撑开） 到底的话 就直接按这个采样点 - 初始点 = fst记录
 * 2. 兜底算法：趋于稳定判定算法：
 *  - 例如页面撑开也不足一屏的情况
 *  - 计算触发case: 
 *      1) onUserInteractive
 *      2) onHide中
 * 兜底fst计算中：真实的稳定一定要满足2个条件：
 * 1. 记录点距离最后一个记录点 距离在 STABLE_CRITICAL_POSITION_VALUE = 10px以内的 可以认为该记录点是一个稳定的记录点 - 算法中会找最早的稳定记录点
 * 2. 触发兜底计算的时候 当前时间距离最早的稳定点的时间段 必须超过 MIN_STABLE_DURATION = 100ms 这个稳定记录点才能看做有效的 可以参与fst计算
 */
const STABLE_CRITICAL_POSITION_VALUE = 10; // 稳定临界值 - top上下波动小于10px均可以认定为稳定的
const MIN_STABLE_DURATION = 100; // 视图稳定的最短持续时间 100ms，如果走兜底判定（tryComputeFST）时，视图稳定时间超过了这个值，就可以任务视图稳定了

class Sampling {
    constructor(pageInstance = wx) {
        this.instance = null;
        this.mutationRecords = []; // 视图变动记录 - 记录每次变动的数据：timeStamp + 靶点距离文档顶部的top值
        this.fst = 0; // 记录最终计算出的fst
        this.viewPortHeight = 0; // 视图的高度
        this.pageStartTime = 0;
        this.isContinueFstJudge = true; // 开关：是否继续秒开判定
        this.pageInstance = pageInstance; // 页面实例
        this.firstInteractiveTime = 0; // 用户第一次交互时间
    }

    async startRecord () {
        this.pageStartTime = this._getTimeStamp();
        
        try {
            const viewPortRect = await this._getTargetViewRect();
    
            this.viewPortHeight = viewPortRect[0].height;
        } catch(err) {
            console.log(err);
            // return; // 可以不写return
        }
    }

    stopRecord () {
        // 关闭继续采样的开关
        this.isContinueFstJudge = false;
    }

    onUserInteractive () {
        // 只有第一次user touch才会触发后续流程, 之前已经触发过interactive了 就不要再计算了
        if (this.firstInteractiveTime > 0) return;
        // 这里记录后 firstInteractiveTime 就不是0了 则前面的防御中 就会短路后面的逻辑 
        // 就不会在第一次interactive后面触发计算fst的逻辑 造成fst被后续污染而失真
        this.firstInteractiveTime = this._getTimeStamp();
        // 尝试计算fst
        this.tryComputeFST();
        // 停止采样
        this.startRecord();
    }

    /**
     * 在onHide或者onUserInteractive中执行的兜底计算 
     * - 例如前面的setData的时候 没有触发计算出fst 则在onHide的时候 会根据采样记录 进行兜底计算
     * - 这里的计算：主要是使用一系列采样获取到的数据进行计算
     * 计算并将FST记录到this.fst
     * @return {number} 计算出的fst
     */
    tryComputeFST () {
        // 是否应该计算FST 
        if (!this._shouldComputeFST()) return;
        
        const currentTimeStamp = this._getTimeStamp();

        const { lastUpdateRecord, lastTopPosi } = this._getLastUpdateRecordAndPosi();
        // defend: 判断是靶点位置是否移动 如果未移动 target <= 0,则疑似白屏
        if (lastTopPosi <= 0) return;

        // 正式计算
        // 1. 找到 firstStableRecord - 第一个稳定的记录
        // 目的：精准化-从队尾（距离lastTopPosi最近的地方开始）取尽可能早的时刻 - 该时刻距离lastTopPosi的距离 < 
        // 其实 这个firstStableRecord 就是距离lastTopPosi在 STABLE_CRITICAL_POSITION_VALUE 内的最早的时刻 一旦大于这个距离的记录 就停止向前探寻
        // 从队尾lastTopPosi倒序遍历向前迫近
        let firstStableRecord = lastUpdateRecord;
        const i = this.mutationRecords.length - 1;
        while (i >= 0) {
            const curRecord = this.mutationRecords[i];

            // 遇到了一个距离lastTopPosi大于 STABLE_CRITICAL_POSITION_VALUE 的记录 则该记录和之前的时间点 就都还未稳定下来 停止遍历
            if (
                !curRecord ||
                !curRecord.targetTop ||
                Math.abs(curRecord.targetTop - lastTopPosi) > STABLE_CRITICAL_POSITION_VALUE
            ) break;

            firstStableRecord = curRecord || lastUpdateRecord; // 这里的||其实无必要 不会触发这个逻辑 前面的if已经包括这个case了
            
            // 下标递减
            i--;
        }

        // 尝试计算fst

        // 判断：稳定的时间必须超过临界值：最小稳定时长 MIN_STABLE_DURATION 
        // 情况分析：（这里的情况是：因为tryComputeFST 会在 onUserInteractive 和 onHide 2 个地方调用 而onUserInteractive一般先于onHIde调用 
        // 这个时候有可能并没有真正稳定下来 所以 这里需要做一次判定）
        if (Math.abs(currentTimeStamp - firstStableRecord.timeStamp) < MIN_STABLE_DURATION) return;
        // 记录fst
        this.fst = firstStableRecord.timeStamp - this.pageStartTime;
    }


    /**
     * 采样期：一般在setData#callback中进行采样
     */
    async sampling () {
        // 检查开关量 是否继续采样
        if (!this.isContinueFstJudge) return;

        const timeStamp = this._getTimeStamp();

        const targetViewRect = await this._getTargetViewRect();
        const targetTop = targetViewRect[0].top;
        this._addMutationRecords(timeStamp, targetTop);
        // 检测是否触底
        this._checkReachBottom({
            timeStamp,
            targetTop
        });
    }

    /**
     * 在每次sampling后进行一次触底检查
     * @param {object} mutationRecord 视图变动记录 { timeStamp, targetTop }
     */
    _checkReachBottom (mutationRecord) {
        // 判断开关量 - 关闭后不必做后续的动作
        if (!this.isContinueFstJudge) return;

        // 判断是否触底: 靶点此时距离文档顶部的距离 > 视口高度viewportHeight
        if (this.viewPortHeight !== 0 && mutationRecord.targetTop >= this.viewPortHeight) {
            // 停止采样
            this.stopRecord();
            // 计算fst
            this.fst = mutationRecord.timeStamp - this.pageStartTime;
            console.log('[FST] reach Bottom: ', this.fst);
        }
    }


    _addMutationRecords (timeStamp, targetTop) {
        this.mutationRecords && this.addMutationRecords.push({
            timeStamp,
            targetTop 
        });
    }

    /**
     * 获取视口的尺寸信息
     * @returns 
     */
    _getViewPortRect () {
        return new Promise((resolve, reject) => {
            const query = wx && wx.createSelectorQuery();
            query && query.selectViewport().boundingClientRect();
            query && query.exec((res) => {
                if (!res || !res[0]) {
                    reject();
                }

                resolve(res);
            });
        });
    }

    /**
     * 获取靶点在页面中的位置信息
     */
    _getTargetViewRect () {
        return new Promise((resolve, reject) => {
            const query = this.pageInstance && this.pageInstance.createSelectorQuery();
            query && query.select('__fst_judge_target').boundingClientRect();
            query && query.exec(res => {
                if (!res || !res[0]) {
                    reject();
                }

                resolve(res);
            });
        });
    }

    _getTimeStamp () {
        return new Date().getTime();
    }

    /**
     * 判断是否应该进行FST的兜底计算
     * 1. 例如之前在reachBottom中已经计算过了的话 就不需要计算了
     * 2. 如果测速记录为空数组的话 也是无法计算的
     * @returns {Boolean}
     */
    _shouldComputeFST () {
        return this.isContinueFstJudge && this.fst === 0 && this.mutationRecords.length !== 0;
    }


    /**
     * 获得采样记录中的最后一次记录 + 最后一次记录中的targetTop
     * @returns {object}
     */
    _getLastUpdateRecordAndPosi () {
        const lastUpdateRecord = 
            this.mutationRecords &&
            this.mutationRecords.length > 0 &&
            this.mutationRecords[this.mutationRecords.length - 1];
        return {
            lastUpdateRecord,
            lastTopPosi: (lastUpdateRecord && lastUpdateRecord.targetTop) || 0
        }
    }
}

Sampling.getSigngleInstance= () => {
    if (this.instance) return this.instance;
    this.instance = new Sampling();
    return this.instance;
}


/**
 * 模块导出
 */
const { getSigngleInstance } = Sampling;

export default Sampling
export {
    getSigngleInstance
}