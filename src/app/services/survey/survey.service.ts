import { Injectable } from '@angular/core';
import { FormDetail } from '@models/FormDetail.namespace';
import { StorageService } from '../storage/storage.service';
import { ApiService } from '../api/api.service';
import { Network } from '@capacitor/network';
import { AlertController } from '@ionic/angular';
import { Observable, catchError, forkJoin, from, mergeMap, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SurveyService {
  private online: boolean = false;
  private surveys: FormDetail.Form[] = [];

  constructor(
    private apiService: ApiService,
    private alertController: AlertController,
    private storageService: StorageService
  ) {
    this.getNetworkStatus();
    this.getLocalSurveys();
  }

  public pushSurvey(survey: FormDetail.Form): void {
    const copy = JSON.parse(JSON.stringify(survey));
    this.surveys.push(copy);
    this.saveSurveys();
  }

  public getNetworkStatus(): void {
    Network.getStatus().then((status) => {
      console.log('Network status:', status.connected);
      this.online = status.connected;
      console.log('Online status is:', this.online);
    });
  }

  public getLocalSurveys(): void {
    this.storageService.get(SURVEYS_STORAGE_KEY).then((surveys) => {
      this.surveys = surveys || [];
    });
  }

  public getSurveys(): FormDetail.Form[] {
    return this.surveys;
  }

  public saveSurveys(): void {
    this.storageService.set(SURVEYS_STORAGE_KEY, this.surveys);
  }

  public syncSurveys(): void {
    if (this.online) {
      const surveysToSync: FormDetail.Form[] = this.surveys.filter((survey) => !survey.sync);
      const syncRequests: Observable<FormDetail.Form | undefined>[] = surveysToSync.map((survey) => {
        return from(this.apiService.post(ENDPOINT, survey)).pipe(
          mergeMap((response) => {
            console.log(response)
            return of(response.status === 200 ? survey : undefined);
          }),
          catchError((error) => {
            console.error(error)
            return of(undefined)
          })
        );
      });

      forkJoin(syncRequests).subscribe((syncResults: (FormDetail.Form | undefined)[]) => {
        const updatedSurveys: FormDetail.Form[] = this.surveys.map((survey) => {
          const syncedSurvey = syncResults.find((syncResult) => syncResult?.id === survey.id);
          if (syncedSurvey) {
            survey.sync = true;
          }

          return survey;
        });
        console.log(updatedSurveys)
        this.surveys = updatedSurveys;
        this.saveSurveys();
      });
    } else {
      this.presentAlert();
    }
  }

  private async presentAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'No hay conexión a internet',
      message: 'Por favor, conéctese a internet para sincronizar las encuestas',
      buttons: ['OK'],
    });

    await alert.present();
  }

  private changeSyncStatus(survey: FormDetail.Form, status: boolean): void {
    const index = this.surveys.indexOf(survey);
    this.surveys[index].sync = status; //TODO save into storage
  }
}

const SURVEYS_STORAGE_KEY = 'uploadSurveys';
const ENDPOINT = SURVEYS_STORAGE_KEY;
