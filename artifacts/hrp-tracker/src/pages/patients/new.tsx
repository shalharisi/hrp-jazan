import React from "react";
import { useI18n } from "@/lib/i18n-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { 
  useCreatePatient, 
  useListSectors, 
  useListHealthCenters 
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  nationalId: z.string().length(10),
  nameAr: z.string().min(2),
  phone: z.string().min(10),
  address: z.string().optional(),
  sectorId: z.coerce.number().min(1, "Sector is required"),
  healthCenterId: z.coerce.number().min(1, "Health Center is required"),
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
      phone: "",
      address: "",
      sectorId: 0,
      healthCenterId: 0,
    },
  });

  const sectorId = form.watch("sectorId");
  const { data: healthCenters } = useListHealthCenters(
    { sectorId: sectorId || undefined },
    { query: { queryKey: ["health-centers", sectorId], enabled: !!sectorId } }
  );

  const createPatient = useCreatePatient();

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPatient.mutate(
      { data: values },
      {
        onSuccess: (patient) => {
          toast({ title: "Success", description: "Patient registered successfully" });
          setLocation(`/patients/${patient.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to register patient", variant: "destructive" });
        }
      }
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">{t("patients.new")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nationalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>National ID</FormLabel>
                    <FormControl>
                      <Input placeholder="10 digits" {...field} />
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
                    <FormLabel>Name (Arabic)</FormLabel>
                    <FormControl>
                      <Input placeholder="الاسم" {...field} />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="05XXXXXXXX" {...field} />
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
                    <FormLabel>Sector</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Sector" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sectors?.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.nameAr}</SelectItem>
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
                    <FormLabel>Health Center</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined} disabled={!sectorId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Health Center" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {healthCenters?.map(hc => (
                          <SelectItem key={hc.id} value={String(hc.id)}>{hc.nameAr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
