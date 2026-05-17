import React from "react";
import { useI18n } from "@/lib/i18n-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import {
  useCreatePatient,
  useListSectors,
  useListHealthCenters,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  nationalId: z.string().length(10, "يجب أن يتكون رقم الهوية من 10 أرقام"),
  nameAr: z.string().min(2, "الاسم مطلوب"),
  dateOfBirth: z.string().optional(),
  phone: z.string().min(10, "رقم الجوال غير صحيح"),
  doctorPhone: z.string().optional(),
  address: z.string().optional(),
  sectorId: z.coerce.number().min(1, "القطاع مطلوب"),
  healthCenterId: z.coerce.number().min(1, "المركز الصحي مطلوب"),
});

export default function PatientNew() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: sectors } = useListSectors();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nationalId: "",
      nameAr: "",
      dateOfBirth: "",
      phone: "",
      doctorPhone: "",
      address: "",
      sectorId: 0,
      healthCenterId: 0,
    },
  });

  const sectorId = form.watch("sectorId");
  const { data: healthCenters } = useListHealthCenters(
    { sectorId: sectorId || undefined },
    { query: { queryKey: ["health-centers", sectorId], enabled: !!sectorId } },
  );

  const createPatient = useCreatePatient();

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPatient.mutate(
      {
        data: {
          nationalId: values.nationalId,
          nameAr: values.nameAr,
          phone: values.phone,
          doctorPhone: values.doctorPhone || null,
          dateOfBirth: values.dateOfBirth || null,
          address: values.address || null,
          healthCenterId: values.healthCenterId,
        },
      },
      {
        onSuccess: (patient) => {
          toast({ title: t("general.saved"), description: t("general.saveSuccess") });
          setLocation(`/patients/${patient.id}`);
        },
        onError: () => {
          toast({ title: "خطأ", description: t("general.saveError"), variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">{t("patients.new")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("patients.patientInfo")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nationalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.nationalId")}</FormLabel>
                      <FormControl>
                        <Input placeholder="10 أرقام" {...field} dir="ltr" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nameAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.name")}</FormLabel>
                      <FormControl>
                        <Input placeholder="الاسم الكامل" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.dateOfBirth")}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.phone")}</FormLabel>
                      <FormControl>
                        <Input placeholder="05XXXXXXXX" {...field} dir="ltr" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="doctorPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.doctorPhone")}</FormLabel>
                      <FormControl>
                        <Input placeholder="05XXXXXXXX" {...field} dir="ltr" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.address")}</FormLabel>
                      <FormControl>
                        <Input placeholder="العنوان" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.sector")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر القطاع" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sectors?.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="healthCenterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("patients.healthCenter")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ? String(field.value) : undefined}
                        disabled={!sectorId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المركز الصحي" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {healthCenters?.map((hc) => (
                            <SelectItem key={hc.id} value={String(hc.id)}>
                              {hc.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={createPatient.isPending} className="w-full">
                {t("general.save")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
