import ReportSDK from 'report-sdk';

const report = (fst) => {
    const reportSDK = new ReportSDK();
    const metricManager = reportSDK.MetricMansager();
    metricManager.setMetric("FST", fst);

    reportSDK.report();
}

export default report