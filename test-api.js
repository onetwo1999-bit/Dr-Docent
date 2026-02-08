// test-api.js (ESM 버전)
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

// .env가 아니라 .env.local 파일을 명시적으로 지칭합니다.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testPubMed() {
    const API_KEY = process.env.PUBMED_API_KEY; 
    
    console.log("🚀 [.env.local 인식 버전] 테스트 시작...");
    
    if (!API_KEY) {
        console.error("❌ 에러: .env.local 파일에서 PUBMED_API_KEY를 찾을 수 없습니다.");
        console.log("💡 확인사항: .env.local 파일 안에 PUBMED_API_KEY=값 형식으로 저장되어 있나요?");
        return;
    }

    console.log(`🔑 API KEY 로드 성공: ${API_KEY.substring(0, 5)}****`);

    try {
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=Diabetes&retmax=1&retmode=json&api_key=${API_KEY}`;
        const response = await axios.get(searchUrl);
        const pmid = response.data.esearchresult.idlist[0];
        
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json&api_key=${API_KEY}`;
        const summaryRes = await axios.get(summaryUrl);
        
        console.log(`✅ [최종 성공] 논문 제목: ${summaryRes.data.result[pmid].title}`);
    } catch (error) {
        console.error("❌ 통신 에러 발생!");
        console.error(`메시지: ${error.message}`);
    }
}

testPubMed();