rm qy9200-1031.tar.gz
tar -cvzf qy9200-1031.tar.gz ./h5
scp qy9200-1031.tar.gz  root@106.55.196.214:/www/wwwroot

ssh root@106.55.196.214
cd /www/wwwroot/
./deploy-uniapp-test-9200.sh
cd ./uniapp-test-9200
ls -lht
# 测试环境app: 106.55.196.214:9200