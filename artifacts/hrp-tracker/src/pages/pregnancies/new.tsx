import React, { useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreatePregnancy, 
  useGetPatientByNid,
  PregnancyInputRiskLevel,
  PregnancyInputReferralRecommendation
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";

const RISK_FACTORS = [
  "تعدد الأجنة", "الحمل خارج الرحم المشتبه به", "عمر الأم فوق 40", "عمر الأم أقل من 16", 
  "BMI 35 أو أكثر", "حمل IVF", "مدخنة", "نتائج فحص الفصل الأول إيجابية", 
  "داء السكري الحملي", "ضغط الدم 140/90 أو أكثر", "هيموغلوبين منخفض أقل من 9", 
  "3 إجهاضات أو أكثر", "ولادة مبكرة سابقة", "وفاة جنينية سابقة", "عملية قيصرية سابقة", 
  "سوابق تسمم الحمل", "جلطات وريدية سابقة"
];

const formSchema = z.object({
  patientId: z.number().min(1, "Patient is required"),
  visitDate: z.string().min(1),
  gestationalAge: z.coerce.number().optional(),
  riskLevel: z.nativeEnum(PregnancyInputRiskLevel),
  referralRecommendation: z.nativeEnum(PregnancyInputReferralRecommendation),
  isVteHighRisk: z.boolean().default(false),
  enoxaparinPrescribed: z.boolean().default(false),
  riskFactors: z.array(z.string()).default([]),
});

export default function PregnancyNew() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [nidSearch, setNidSearch] = useState("");
  const { data: searchResult, refetch } = useGetPatientByNid(nidSearch, {
    query: { enabled: false }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patientId: 0,
      visitDate: new Date().toISOString().split("T")[0],
      riskLevel: PregnancyInputRiskLevel.low,
      referralRecommendation: PregnancyInputReferralRecommendation.follow_at_center,
      isVteHighRisk: false,
      enoxaparinPrescribed: false,
      riskFactors: [],
    },
  });

  const handleSearch = async () => {
    if (nidSearch.length === 10) {
      const res = await refetch();
      if (res.data?.patient) {
        form.setValue("patientId", res.data.patient.id);
        toast({ title: "Patient found", description: res.data.patient.nameAr });
      } else {
        toast({ title: "Not found", description: "Patient not found", variant: "destructive" });
      }
    }
  };

  const createPregnancy = useCreatePregnancy();

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPregnancy.mutate(
      { data: values },
      {
        onSuccess: (pregnancy) => {
          toast({ title: "Success", description: "Case created successfully" });
          setLocation(`/pregnancies/${pregnancy.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create case", variant: "destructive" });
        }
      }
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">New Pregnancy Case</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Patient Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <FormLabel>National ID</FormLabel>
              <Input 
                placeholder="Enter 10 digit National ID" 
                value={nidSearch}
                onChange={(e) => setNidSearch(e.target.value)}
              />
            </div>
            <Button onClick={handleSearch} type="button">
              <Search className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              Search
            </Button>
          </div>
          {searchResult?.patient && (
            <div className="mt-4 p-4 bg-muted rounded-md flex items-center justify-between">
              <div>
                <p className="font-medium">{searchResult.patient.nameAr}</p>
                <p className="text-sm text-muted-foreground">{searchResult.patient.healthCenterNameAr}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={form.watch("patientId") ? "" : "opacity-50 pointer-events-none"}>
        <CardHeader>
          <CardTitle>Case Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="visitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gestationalAge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gestational Age (weeks)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="riskLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(PregnancyInputRiskLevel).map(level => (
                            <SelectItem key={level} value={level}>{t(`risk.${level}` as any)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referralRecommendation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Recommendation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(PregnancyInputReferralRecommendation).map(rec => (
                            <SelectItem key={rec} value={rec}>{t(`referral.${rec}` as any)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormLabel>Risk Factors</FormLabel>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {RISK_FACTORS.map((factor) => (
                    <FormField
                      key={factor}
                      control={form.control}
                      name="riskFactors"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={factor}
                            className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 rounded-md border p-4"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(factor)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, factor])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== factor
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                              {factor}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="isVteHighRisk"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>VTE High Risk</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enoxaparinPrescribed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Enoxaparin Prescribed</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={createPregnancy.isPending || !form.watch("patientId")} className="w-full">
                {t("general.save")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
