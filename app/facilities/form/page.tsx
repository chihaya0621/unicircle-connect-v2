import type { Metadata } from "next";

import { BackLink } from "@/components/BackLink";
import { FacilityFormEditor } from "@/components/FacilityFormEditor";
import { FacilityUseForm } from "@/components/FacilityUseForm";
import { PageHero } from "@/components/PageHero";
import { getMyUniversityId, requireRole } from "@/lib/dal";
import { getFacilityUseForm, listFacilities } from "@/lib/facilities";

export const metadata: Metadata = { title: "使用許可願の項目 | UniCircle Connect" };

/**
 * 施設使用許可願のうち、大学ごとに違う部分を職員が変える画面（0038）。
 *
 * 基本の項目（団体名・目的・利用人員・日時・使用用具・備考）は変えられない。
 * 隣に、保存した様式で学生にどう見えるかの見本を出す。
 */
export default async function FacilityFormPage() {
  await requireRole("staff");
  const universityId = await getMyUniversityId();
  if (!universityId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="glass-empty py-12">
          所属大学が登録されていないため、使用許可願の項目を変えられません。
        </p>
      </div>
    );
  }

  const [form, facilities] = await Promise.all([
    getFacilityUseForm(universityId),
    listFacilities(universityId),
  ]);
  // 追加の項目を尋ねる先に選べるのは施設だけ（備品は貸出の様式が別）
  const targets = facilities
    .filter((f) => f.category !== "equipment")
    .map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <BackLink href="/facilities" label="施設・備品" />
      <PageHero
        variant="stack"
        eyebrow="FORM"
        title="使用許可願の項目"
        description="施設使用許可願のうち、大学ごとに違う注意事項・学外者についての確認・追加の項目を変えられます。保存すると、学生のフォームにすぐに出ます。"
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="form-editor" className="glass-panel">
          <h2 id="form-editor" className="mb-4 text-lg font-semibold">
            項目を変える
          </h2>
          <FacilityFormEditor
            initial={form}
            facilities={targets}
            version={JSON.stringify(form)}
          />
        </section>

        <section aria-labelledby="form-preview">
          <h2 id="form-preview" className="mb-1 text-lg font-semibold">
            学生に見える形（見本）
          </h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            保存した内容で出しています。一部の施設だけで尋ねる項目も、ここでは並べています。
          </p>
          <div className="glass-panel">
            <FacilityUseForm preview facilityId="" circles={[]} form={form} />
          </div>
        </section>
      </div>
    </div>
  );
}
